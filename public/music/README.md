# 音乐文件上传说明

## 如何添加音乐到你的网站

### 1. 准备音乐文件
- 支持的格式：MP3, WAV, OGG, M4A
- 建议文件大小：每首歌不超过 10MB
- 建议音质：128kbps - 320kbps

### 2. 文件命名规范
请按照以下格式命名你的音乐文件：
- 使用小写字母和连字符
- 避免使用空格和特殊字符
- 例如：`plastic-love.mp3`, `never-meant.mp3`

### 3. 上传步骤
1. 将音乐文件放置在 `/public/music/` 目录下
2. 确保文件名与 `Music.jsx` 中对应歌曲的 `audioFile` 路径匹配
3. 重新构建并部署网站

### 4. 当前需要的音乐文件
根据音乐页面的配置，你需要准备以下文件：

- `how-to-count-one-to-ten.mp3` - parade
- `my-instincts-are-the-enemy-aag.mp3` - Age of Ghosts
- `never-meant.mp3` - American Football
- `my-instincts-are-the-enemy-af.mp3` - American Football
- `seventeen-years.mp3` - Ratatat
- `the-soldiers-from-the-war-returning-speak.mp3` - MAN WITH A MISSION
- `plastic-love.mp3` - 竹内まりや
- `chenjianghe-sujiangshui.mp3` - 陈江河
- `sayonara-wa-emotion.mp3` - サヨナラは emotion
- `mikazuki-sunset.mp3` - 三日月サンセット
- `weini-nan-de-ge.mp3` - 方大同
- `tsuki-no-wan.mp3` - 魚韻

### 5. 注意事项
- 请确保你拥有音乐文件的合法使用权
- 如果是商业用途，请注意版权问题
- 建议压缩音频文件以减少加载时间
- 可以使用在线音频转换工具来优化文件格式和大小

### 6. 测试播放
上传文件后，访问网站的音乐页面，点击播放按钮测试音频是否正常播放。如果无法播放，请检查：
- 文件路径是否正确
- 文件格式是否支持
- 文件是否损坏

---

**提示**：如果你暂时没有音乐文件，播放器会显示"暂无音频文件"的提示信息。