# VS Code Copilot 接入 GPT-5.6 自定义模型设计

## 背景

当前 VS Code 1.128 的 Copilot 自定义模型配置存在于以下两个作用域：

- 用户作用域：`~/Library/Application Support/Code/User/chatLanguageModels.json`
- 内置 Agents Profile：`~/Library/Application Support/Code/User/profiles/builtin/agents/chatLanguageModels.json`

现有 `AACCX` provider 已通过 OpenAI Responses API 接入 `gpt-5.5`、`gpt-5.4` 和 `gpt-5.4-mini`。本次需要新增 GPT-5.6，同时完整保留现有模型配置。

## 服务端模型事实

通过现有鉴权只读查询 `https://api.aaccx.pw/v1/models`，服务端没有提供通用的 `gpt-5.6` ID，而是提供三个独立模型：

- `gpt-5.6-sol`
- `gpt-5.6-terra`
- `gpt-5.6-luna`

因此不能把 Copilot 模型 ID 写成未经服务端声明的 `gpt-5.6`。

## 方案选择

采用在现有 `AACCX` provider 的 `models` 数组中追加三个模型条目的方案。

未采用以下方案：

- 只添加其中一个模型：会隐藏服务端已经提供的另外两个可选模型。
- 为每个模型创建独立 provider：会重复 endpoint、鉴权和能力配置，增加维护成本。
- 使用 `gpt-5.6` 作为别名：服务端未声明该 ID，可能直接返回 model not found。

## 配置设计

三个模型分别使用如下显示名称：

- `GPT-5.6 Sol`
- `GPT-5.6 Terra`
- `GPT-5.6 Luna`

每个模型沿用已验证可用的 GPT-5.5 配置能力：

- endpoint：`https://api.aaccx.pw/v1/responses`
- API 类型：`responses`
- 工具调用：启用
- reasoning：启用
- 思考等级：`minimal`、`low`、`medium`、`high`、`xhigh`
- reasoning 格式：`responses`
- Zero Data Retention：启用
- 最大输入 token：`120000`
- 最大输出 token：`8000`
- 鉴权：复用现有 provider 和模型条目的凭据，不在文档或日志中输出真实 Key

两个配置文件保持相同的 provider 和模型列表，避免切换 VS Code profile 后模型消失。

## 验证

实施后执行以下验证：

1. 两个 JSON 文件均可被 `jq` 正常解析。
2. 两个文件都保留 `gpt-5.5`，并新增三个 GPT-5.6 ID。
3. 检查三个新增模型均使用 `/v1/responses`，并包含完整 reasoning 配置。
4. 通过 VS Code 的 `Developer: Reload Window` 重新加载配置。
5. 在 Copilot 模型选择器中确认三个模型均可见。

## 回退

修改前分别创建本地备份。若 Copilot 无法加载新增模型，只删除三个 GPT-5.6 条目并恢复备份，不改动现有 GPT-5.5 配置。
