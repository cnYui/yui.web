const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..')));

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// CSV文件路径
const postsFile = path.join(dataDir, 'posts.csv');

// 创建CSV写入器
const csvWriter = createCsvWriter({
  path: postsFile,
  header: [
    { id: 'id', title: 'ID' },
    { id: 'title', title: '标题' },
    { id: 'content', title: '内容' },
    { id: 'date', title: '日期' }
  ]
});

// 确保CSV文件存在
if (!fs.existsSync(postsFile)) {
  csvWriter.writeRecords([]).then(() => {
    console.log('创建了空的CSV文件');
  });
}

// 获取所有帖子
app.get('/api/posts', (req, res) => {
  console.log('收到获取帖子请求');
  
  // 设置CORS头
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  // 检查文件是否存在
  if (!fs.existsSync(postsFile)) {
    console.log('CSV文件不存在，返回空数组');
    return res.json([]);
  }
  
  const posts = [];
  console.log('开始读取CSV文件:', postsFile);
  
  fs.createReadStream(postsFile)
    .pipe(csv())
    .on('data', (data) => {
      console.log('读取到数据:', data);
      posts.push(data);
    })
    .on('end', () => {
      console.log('返回帖子数据，总数:', posts.length);
      res.json(posts);
    })
    .on('error', (error) => {
      if (error.code === 'ENOENT') {
        // 文件不存在，返回空数组
        console.log('CSV文件不存在，返回空数组');
        res.json([]);
      } else {
        console.error('读取CSV文件出错:', error);
        res.status(500).json({ error: '服务器错误' });
      }
    });
});

// 添加新帖子
app.post('/api/posts', (req, res) => {
  const { title, content } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: '标题和内容不能为空' });
  }
  
  // 读取现有帖子以获取最大ID
  const posts = [];
  
  const readStream = fs.createReadStream(postsFile)
    .pipe(csv())
    .on('data', (data) => posts.push(data))
    .on('end', () => {
      // 生成新ID - 确保不重复
      let maxId = 0;
      if (posts.length > 0) {
        // 处理可能的大小写问题和空值
        posts.forEach(post => {
          const id = parseInt(post.id || post.ID || post['ID'] || 0);
          if (!isNaN(id) && id > maxId) {
            maxId = id;
          }
        });
      }
      const newId = maxId + 1;
      
      // 创建新帖子
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const newPost = {
        id: newId,
        title,
        content,
        date: dateStr
      };
      
      // 添加到CSV文件
      csvWriter.writeRecords([newPost])
        .then(() => {
          console.log('帖子已添加到CSV文件');
          res.status(201).json(newPost);
        })
        .catch(error => {
          console.error('写入CSV文件出错:', error);
          res.status(500).json({ error: '服务器错误' });
        });
    })
    .on('error', (error) => {
      if (error.code === 'ENOENT') {
        // 文件不存在，创建第一个帖子
        const newPost = {
          id: 1,
          title,
          content,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        
        csvWriter.writeRecords([newPost])
          .then(() => {
            console.log('第一个帖子已添加到CSV文件');
            res.status(201).json(newPost);
          })
          .catch(error => {
            console.error('写入CSV文件出错:', error);
            res.status(500).json({ error: '服务器错误' });
          });
      } else {
        console.error('读取CSV文件出错:', error);
        res.status(500).json({ error: '服务器错误' });
      }
    });
});

// 管理员登录API
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  // 简单的管理员认证（在生产环境中应使用更安全的方式）
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'yui2025'; // 您可以修改这个密码
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // 生成简单的token（在生产环境中应使用JWT）
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
});

// 删除帖子API
app.delete('/api/posts/:id', (req, res) => {
  const postId = req.params.id;
  const authHeader = req.headers.authorization;
  
  // 简单的token验证
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权访问' });
  }
  
  console.log(`尝试删除帖子 ID: ${postId}`);
  
  // 读取现有帖子
  fs.readFile(csvFilePath, 'utf8', (error, data) => {
    if (error && error.code !== 'ENOENT') {
      console.error('读取CSV文件出错:', error);
      return res.status(500).json({ error: '服务器错误' });
    }
    
    let posts = [];
    if (data) {
      const lines = data.trim().split('\n');
      if (lines.length > 1) {
        for (let i = 1; i < lines.length; i++) {
          const [id, title, content, date] = lines[i].split(',');
          if (id && id !== postId) {
            posts.push({ id, title, content, date });
          }
        }
      }
    }
    
    // 重新写入CSV文件
    const csvWriter = createCsvWriter({
      path: csvFilePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'title', title: '标题' },
        { id: 'content', title: '内容' },
        { id: 'date', title: '日期' }
      ]
    });
    
    csvWriter.writeRecords(posts)
      .then(() => {
        console.log(`帖子 ID ${postId} 已删除`);
        res.json({ success: true, message: '帖子已删除' });
      })
      .catch(error => {
        console.error('写入CSV文件出错:', error);
        res.status(500).json({ error: '服务器错误' });
      });
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
