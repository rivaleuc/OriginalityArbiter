# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *

MAX_CONTENT_CHARS = 4000
MAX_WEB_EVIDENCE = 5000
PLAGIARISM_THRESHOLD = 40  # below this score = not original enough


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
            if isinstance(raw, dict):
                return json.dumps(raw)
            return str(raw).strip()

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                data = json.loads(leader_result.calldata)
                score = data.get("originality_score")
                if not isinstance(score, int) or score < 0 or score > 100:
                    return False
                if not isinstance(data.get("is_original"), bool):
                    return False
                if not isinstance(data.get("reasoning"), str):
                    return False
                return True
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
