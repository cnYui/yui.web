# 旅游照片文件夹

这个文件夹专门用来存放旅行摄影的照片。

## 文件夹结构

- `mountains/` - 山川风景照片（如黄山、张家界等）
- `cities/` - 古城和城市风光照片（如丽江、西安等）
- `beaches/` - 海滩和海岸风光照片（如三亚等）
- `landscapes/` - 其他自然风光照片

## 使用说明

1. 请将照片按类型分类存放到对应的子文件夹中
2. 建议照片文件名使用有意义的名称，如：`huangshan_sunrise_2025.jpg`
3. 支持的图片格式：JPG, PNG, WEBP
4. 建议照片尺寸不超过2MB，以确保网页加载速度

## 在网页中使用

在 `travel.html` 页面中引用照片时，使用相对路径：
```html
<img src="images/travel/mountains/huangshan_sunrise.jpg" alt="黄山日出">
```
