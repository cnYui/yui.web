const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// CSV文件路径
const postsFile = path.join(__dirname, 'data', 'posts.csv');

console.log('测试读取CSV文件:', postsFile);
console.log('文件是否存在:', fs.existsSync(postsFile));

// 读取CSV文件
const posts = [];
fs.createReadStream(postsFile)
  .pipe(csv())
  .on('data', (data) => {
    console.log('读取到数据:', data);
    posts.push(data);
  })
  .on('end', () => {
    console.log('所有帖子数据:', posts);
  })
  .on('error', (error) => {
    console.error('读取CSV文件出错:', error);
  });
