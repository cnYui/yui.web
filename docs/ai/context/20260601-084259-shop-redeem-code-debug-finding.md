# 商店兑换码无法兑换诊断结果

## 结论

用户输入的兑换码是 `YUI-CDAO5B-DDF7D6`，其中 `CDAO5B` 的第四个字符是字母 `O`。

当前 `data/shop.sqlite` 中实际存在且未兑换的兑换码是 `YUI-CDA05B-DDF7D6`，其中 `CDA05B` 的第四个字符是数字 `0`。

## 证据

- `invite_codes` 中精确查询 `YUI-CDAO5B-DDF7D6` 无结果。
- `invite_codes` 当前存在 `YUI-CDA05B-DDF7D6`，状态为 `unused`。
- `api_keys` 当前还有 7 个 `unused` key，因此不是 API key 池耗尽。
- 兑换接口会把输入转成大写，但不会把字母 `O` 自动改成数字 `0`，所以会返回 `INVITE_NOT_FOUND`。

## 后续建议

短期直接使用 `YUI-CDA05B-DDF7D6` 兑换。

如果后续要减少人工输入错误，可以在前后端增加兑换码格式校验或明确提示：兑换码只会使用数字和 `A-F`，不会包含字母 `O`。
