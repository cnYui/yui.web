# GitHub 上传指导说明

## 项目状态

✅ **已完成的步骤：**
- Git 仓库已初始化
- .gitignore 文件已创建
- 项目文件已添加到 Git
- 初始提交已完成
- 远程仓库地址已添加：`https://github.com/cnYui/Ripple_Grid.git`

## 🔐 身份验证问题解决方案

推送时遇到身份验证失败，需要配置 GitHub 访问权限。有以下几种解决方案：

### 方案一：使用 Personal Access Token (推荐)

1. **生成 Personal Access Token：**
   - 访问 GitHub Settings: https://github.com/settings/tokens
   - 点击 "Generate new token" → "Generate new token (classic)"
   - 设置 Token 名称，如："Ripple_Grid_Upload"
   - 选择权限：勾选 `repo` (完整仓库访问权限)
   - 点击 "Generate token"
   - **重要：复制并保存生成的 token，它只会显示一次**

2. **使用 Token 推送：**
   ```bash
   git push https://<your-username>:<your-token>@github.com/cnYui/Ripple_Grid.git main
   ```
   
   或者更新远程仓库地址：
   ```bash
   git remote set-url origin https://<your-username>:<your-token>@github.com/cnYui/Ripple_Grid.git
   git push -u origin main
   ```

### 方案二：使用 SSH 密钥

1. **生成 SSH 密钥：**
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```

2. **添加 SSH 密钥到 GitHub：**
   - 复制公钥内容：`cat ~/.ssh/id_ed25519.pub`
   - 访问 GitHub Settings: https://github.com/settings/ssh
   - 点击 "New SSH key"，粘贴公钥内容

3. **更新远程仓库地址为 SSH：**
   ```bash
   git remote set-url origin git@github.com:cnYui/Ripple_Grid.git
   git push -u origin main
   ```

### 方案三：使用 GitHub CLI (gh)

1. **安装 GitHub CLI：**
   ```bash
   brew install gh  # macOS
   ```

2. **登录 GitHub：**
   ```bash
   gh auth login
   ```

3. **推送代码：**
   ```bash
   git push -u origin main
   ```

## 📋 完整推送命令

选择上述任一方案配置身份验证后，执行：

```bash
# 推送到远程仓库
git push -u origin main

# 验证推送成功
git remote -v
git status
```

## 🔍 验证上传成功

推送成功后，访问 https://github.com/cnYui/Ripple_Grid 确认：
- 所有项目文件已上传
- README.md 显示正确
- 提交历史包含初始提交

## 📁 项目结构

上传的项目包含以下文件：
```
Ripple_Grid/
├── .gitignore
├── README.md
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── components/
│       ├── RippleGrid.jsx
│       └── RippleGrid.css
└── doc/
    ├── code.md
    ├── Circular_Gallery.md
    ├── Falling_Text.md
    ├── Lanyard.md
    ├── Pill_Nav.md
    └── Rolling_Gallery.md
```

## 🚀 后续步骤

1. **配置 GitHub Pages（可选）：**
   - 在仓库 Settings → Pages 中配置
   - 选择 Source: GitHub Actions
   - 可以部署 Vite 应用到 GitHub Pages

2. **添加协作者（如需要）：**
   - 在仓库 Settings → Collaborators 中添加

3. **设置分支保护规则（可选）：**
   - 在仓库 Settings → Branches 中配置

## ❗ 注意事项

- Personal Access Token 具有敏感性，请妥善保管
- 不要在代码中硬编码 Token
- 定期更新和轮换访问凭据
- 确保 .gitignore 文件正确配置，避免上传敏感文件

---

**需要帮助？** 如果遇到问题，请检查：
1. GitHub 仓库是否存在且有写入权限
2. 网络连接是否正常
3. Git 配置是否正确：`git config --list`