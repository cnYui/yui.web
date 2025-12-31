# 网页图片资源目录

## 文件夹结构

### `/hackathon/` - 黑客松活动图片
- `trae-hackathon-01.jpg` - TRAE黑客松活动现场1
- `trae-hackathon-02.jpg` - TRAE黑客松活动现场2  
- `trae-hackathon-03.jpg` - TRAE黑客松签到展板
- `trae-hackathon-04.jpg` - TRAE黑客松获奖照片
- `trae-hackathon-05.jpg` - TRAE Friends南京活动
- `trae-hackathon-06.jpg` - TRAE Friends苏州活动

### `/presentations/` - 演讲展示图片
- `trae-presentation-01.jpg` - 南客松演讲现场1
- `trae-presentation-02.jpg` - 演讲展示现场2

### `/events/` - 其他活动图片
- `trae-event-01.jpg` - TRAE活动现场

### `/profile/` - 个人资料图片
- `tech-blog-profile.jpg` - 技术博客头像

### `/animate/` - 动画相关图片
- 包含多个动画帧图片

### `/music_pic/` - 音乐推荐相关图片
- 包含音乐专辑封面等

### `/travel/` - 旅行足迹图片
- 按城市分类的旅行照片

## 使用说明

在React组件中引用图片时，使用相对路径：
```jsx
// 例如引用黑客松图片
<img src="/images/hackathon/trae-hackathon-01.jpg" alt="TRAE黑客松活动" />
```

## 图片命名规范

- 使用英文小写字母和连字符
- 按类型和序号命名：`类型-描述-序号.扩展名`
- 保持文件名简洁且具有描述性
