# AI 协作记忆

## 2026-06-11 DeepSeek 真实扣费

- Shop 真实扣费以 yui.web 内部固定人民币价格为准，不信任 usage event 的 `price_amount_micros`。
- 当前固定价格版本为 `deepseek-v4-pro-rmb-20260424`：
  - 缓存命中输入：25 nanos/token
  - 缓存未命中输入：3000 nanos/token
  - 输出：6000 nanos/token
- `reasoning_tokens` 只展示，不重复计费。
- 旧 JSONL 兼容规则：`cache_hit_input_tokens = cached_tokens`，`cache_miss_input_tokens = max(input_tokens - cached_tokens, 0)`。
- 账务事实字段使用 nanos；旧 cents 字段只做兼容展示和旧接口兼容。
- 相关实施记录见 `docs/ai/context/20260611-104500-deepseek-pro-rmb-real-billing-implementation_CN.md`。
