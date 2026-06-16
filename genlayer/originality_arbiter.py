# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *

MAX_CONTENT_CHARS = 4000
MAX_WEB_EVIDENCE = 5000
PLAGIARISM_THRESHOLD = 40  # below this score = not original enough


# ----------------------------------------------------------------------
# Pure deterministic helpers (no LLM / no I/O) — unit-testable and used by
# both the leader (to derive a passing verdict) and validators (to recompute
# the cross-field invariant). NEVER compare free-form LLM text here.
# ----------------------------------------------------------------------

def _coerce_int(value, default: int = 0) -> int:
    """Best-effort int coercion that rejects bools."""
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def normalize_originality_verdict(data: dict) -> dict:
    """Clamp the score to [0,100] and DERIVE is_original from it so honest
    leaders always satisfy the validator invariant. Reasoning is forced
    non-empty so the normalized output is always valid."""
    score = max(0, min(100, _coerce_int(data.get("originality_score"), 0)))
    reasoning = str(data.get("reasoning") or "").strip() or "no reasoning provided"
    similar = str(data.get("similar_sources") or "").strip() or "none found"
    return {
        "originality_score": score,
        "is_original": bool(score >= PLAGIARISM_THRESHOLD),
        "reasoning": reasoning,
        "similar_sources": similar,
    }


def validate_originality_verdict(data: dict) -> bool:
    """Deterministic anchor: score range + is_original == (score >= threshold)
    + non-empty reasoning. Recomputed identically by every validator."""
    score = data.get("originality_score")
    if not isinstance(score, int) or isinstance(score, bool):
        return False
    if score < 0 or score > 100:
        return False
    is_original = data.get("is_original")
    if not isinstance(is_original, bool):
        return False
    if is_original != (score >= PLAGIARISM_THRESHOLD):
        return False
    reasoning = data.get("reasoning")
    if not isinstance(reasoning, str) or not reasoning.strip():
        return False
    return True


class OriginalityArbiter(gl.Contract):
    owner: str
    submissions: TreeMap[str, str]  # key -> JSON record
    submission_count: u256
    total_rewarded: u256
    total_rejected: u256

    def __init__(self):
        self.owner = str(gl.message.sender_address)
        self.submission_count = u256(0)
        self.total_rewarded = u256(0)
        self.total_rejected = u256(0)

    # ------------------------------------------------------------------
    # Submit content for originality judgment
    # ------------------------------------------------------------------

    @gl.public.write
    def submit(self, content: str, content_type: str, source_url: str) -> str:
        """
        Submit content for AI originality judgment.
        content_type: article, code, design, tweet, etc.
        source_url: where the content is published (for verification)
        """
        content = str(content).strip()
        if not content:
            raise Exception("content required")
        if len(content) > MAX_CONTENT_CHARS:
            raise Exception(f"content too long (max {MAX_CONTENT_CHARS} chars)")
        content_type = str(content_type).strip() if content_type else "article"
        source_url = str(source_url).strip() if source_url else ""

        verdict = self._judge_originality(content, content_type, source_url)

        key = str(int(self.submission_count))
        record = {
            "author": str(gl.message.sender_address),
            "content_preview": content[:200],
            "content_type": content_type,
            "source_url": source_url,
            "originality_score": verdict["originality_score"],
            "is_original": verdict["is_original"],
            "reasoning": verdict["reasoning"],
            "similar_sources": verdict["similar_sources"],
            "appealed": False,
        }
        self.submissions[key] = json.dumps(record)
        self.submission_count += u256(1)
        if verdict["is_original"]:
            self.total_rewarded += u256(1)
        else:
            self.total_rejected += u256(1)
        return key

    # ------------------------------------------------------------------
    # Appeal: re-judge with fresh web search
    # ------------------------------------------------------------------

    @gl.public.write
    def appeal(self, key: str) -> None:
        key = str(key)
        if key not in self.submissions:
            raise Exception("unknown submission")
        record = json.loads(self.submissions[key])
        if record["author"] != str(gl.message.sender_address):
            raise Exception("only author can appeal")

        verdict = self._judge_originality(
            record["content_preview"], record["content_type"], record["source_url"]
        )
        was_original = record["is_original"]
        record["appealed"] = True
        record["originality_score"] = verdict["originality_score"]
        record["is_original"] = verdict["is_original"]
        record["reasoning"] = verdict["reasoning"]
        record["similar_sources"] = verdict["similar_sources"]
        self.submissions[key] = json.dumps(record)

        # Update counters if verdict flipped
        if was_original and not verdict["is_original"]:
            self.total_rewarded -= u256(1)
            self.total_rejected += u256(1)
        elif not was_original and verdict["is_original"]:
            self.total_rejected -= u256(1)
            self.total_rewarded += u256(1)

    # ------------------------------------------------------------------
    # AI consensus judgment
    # ------------------------------------------------------------------

    def _judge_originality(self, content: str, content_type: str, source_url: str) -> dict:
        def leader_fn() -> str:
            # Try to find similar content on the web
            web_evidence = "(no web search performed)"
            if source_url and source_url.startswith("http"):
                try:
                    raw = gl.nondet.web.get(source_url)
                    web_evidence = raw.body.decode("utf-8")[:MAX_WEB_EVIDENCE]
                except Exception:
                    web_evidence = "(source URL fetch failed)"

            prompt = f"""You are an originality judge for a content platform. Your job is to assess whether submitted content is original or plagiarized/AI-generated without attribution.

CONTENT TYPE: {content_type}
SUBMITTED CONTENT:
{content[:MAX_CONTENT_CHARS]}

SOURCE URL CONTENT (if available):
{web_evidence[:2000]}

JUDGMENT CRITERIA:
1. Score originality from 0-100 (0=copied verbatim, 100=completely novel)
2. Check for signs of plagiarism, unattributed copying, or wholesale AI generation
3. Consider: unique voice, novel ideas, specific personal experiences, original analysis
4. Content that adds genuine value even if referencing others = original
5. Threshold: score >= {PLAGIARISM_THRESHOLD} = original enough for rewards

Reply ONLY valid JSON:
{{"originality_score": <0-100>, "is_original": true/false, "reasoning": "<brief explanation>", "similar_sources": "<any detected sources or 'none found'>"}}
No markdown, no code fences."""

            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            data = raw if isinstance(raw, dict) else json.loads(str(raw).strip())
            # Derive the invariant in the leader so honest leaders always pass.
            return json.dumps(normalize_originality_verdict(data))

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                data = json.loads(leader_result.calldata)
                return validate_originality_verdict(data)
            except Exception:
                return False

        result_str = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        return json.loads(result_str)

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------

    @gl.public.view
    def get_submission(self, key: str) -> dict:
        key = str(key)
        if key not in self.submissions:
            return {"exists": False}
        return json.loads(self.submissions[key])

    @gl.public.view
    def read_reward_eligibility(self, key: str) -> dict:
        """Vault resolver reads this to determine if author gets rewarded."""
        key = str(key)
        if key not in self.submissions:
            return {"eligible": False}
        record = json.loads(self.submissions[key])
        return {
            "eligible": record["is_original"],
            "author": record["author"],
            "score": record["originality_score"],
            "key": key,
        }

    @gl.public.view
    def stats(self) -> dict:
        return {
            "total_submissions": int(self.submission_count),
            "rewarded": int(self.total_rewarded),
            "rejected": int(self.total_rejected),
        }
