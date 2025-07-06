// API地址
const API_URL = 'http://localhost:3000/api';

// 默认帖子数据（如果API请求失败时使用）
const defaultPosts = [
  {
    id: '1',
    title: '欢迎来到悠一的二次元小站',
    content: '大家好，这是我的第一篇帖子！<br><br>在这里我将分享我对动漫、游戏、轻小说等二次元内容的看法和感受。<br><br>希望大家喜欢我的内容，也欢迎在评论区留言交流！',
    date: '2025-07-05 19:00'
  },
  {
    id: '2',
    title: '本季新番推荐',
    content: '分享一下我最近在看的几部新番：<br><br>1. 《魔法少女的日常》 - 这部作品的画风非常精美，剧情轻松有趣，非常适合放松心情。<br><br>2. 《星空之旅》 - 科幻题材，但剧情非常温暖，描绘了人类与宇宙的关系，画面精美。<br><br>3. 《刀刃的记忆》 - 热血格斗番，故事情节很有深度，战斗场景很燃！<br><br>大家有什么喜欢的新番推荐吗？',
    date: '2025-07-04 15:30'
  },
  {
    id: '3',
    title: '最近在玩的游戏',
    content: '最近我在玩的一款游戏叫《幻想世界》，这是一款开放世界的RPG游戏。<br><br>游戏中的世界观非常独特，融合了魔幻和未来科技元素。角色可定制性很高，战斗系统也很有深度。<br><br>最喜欢的是游戏中的副本设计，每个副本都有不同的解法和故事线，可以多次挑战。<br><br>大家最近在玩什么游戏呢？欢迎分享！',
    date: '2025-07-03 20:15'
  },
  {
    id: '4',
    title: '轻小说阅读笔记',
    content: '最近读完了《星空图书馆》这部轻小说，非常温馨的一部作品。<br><br>故事讲述了一个坐落在小镇上的神秘图书馆，馆主是一位来自异世界的少女。每一个进入图书馆的人都能找到一本能够改变自己命运的书。<br><br>作者的文笔非常优美，尤其是对星空和宇宙的描写充满诗意。人物形象也很鲜明，每个角色都有自己的成长故事。<br><br>强烈推荐给喜欢温馨治愈系作品的朋友！',
    date: '2025-07-02 10:45'
  }
];

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 导航栏滚动隐藏功能
  const header = document.querySelector('header');
  let lastScrollTop = 0;
  
  window.addEventListener('scroll', function() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // 判断滚动方向
    if (scrollTop > lastScrollTop && scrollTop > 50) {
      // 向下滚动且不在顶部，隐藏导航栏
      header.classList.add('header-hidden');
    } else {
      // 向上滚动或在顶部，显示导航栏
      header.classList.remove('header-hidden');
    }
    
    lastScrollTop = scrollTop;
  });

  // 帖子发布功能
  const postForm = document.getElementById('post-form');
  if (postForm) {
    postForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // 获取表单数据
      const title = document.getElementById('post-title').value;
      const content = document.getElementById('post-content').value;
      
      if (!title || !content) {
        alert('标题和内容不能为空！');
        return;
      }
      
      // 显示加载状态
      const submitBtn = postForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '发布中...';
      submitBtn.disabled = true;
      
      // 发送到后端 API
      fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('发布失败');
        }
        return response.json();
      })
      .then(newPost => {
        // 创建新帖子元素
        const postList = document.getElementById('post-list');
        const postItem = document.createElement('div');
        postItem.className = 'post-item';
        postItem.dataset.id = newPost.id;
        
        // 设置帖子HTML
        postItem.innerHTML = `
          <div class="post-header">
            <h3 class="post-title">${newPost.title}</h3>
            <span class="post-meta">${newPost.date}</span>
          </div>
          <div class="post-content">${newPost.content.replace(/\n/g, '<br>')}</div>
        `;
        
        // 添加到帖子列表的顶部
        if (postList.firstChild) {
          postList.insertBefore(postItem, postList.firstChild);
        } else {
          postList.appendChild(postItem);
        }
        
        // 清空表单
        postForm.reset();
        
        // 恢复按钮状态
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      })
      .catch(error => {
        console.error('发布帖子错误:', error);
        alert('发布失败，请重试');
        
        // 恢复按钮状态
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      });
    });
  }
  
  // 管理员功能
  setupAdminFeatures();
  
  // 加载帖子
  loadPosts();
});

// 从后端加载帖子
function loadPosts() {
  const postList = document.getElementById('post-list');
  if (!postList) return;
  
  // 显示加载状态
  const loadingElement = document.createElement('div');
  loadingElement.className = 'loading-message';
  loadingElement.id = 'loading-message'; // 添加ID便于后续删除
  loadingElement.textContent = '正在加载帖子...';
  postList.innerHTML = '';
  postList.appendChild(loadingElement);
  
  console.log('开始加载帖子，请求URL:', `${API_URL}/posts`);
  
  // 设置超时处理
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('请求超时')), 5000); // 增加超时时间到 5 秒
  });
  
  // 从后端 API 获取帖子
  Promise.race([
    fetch(`${API_URL}/posts`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-cache' // 禁用缓存，确保每次都获取最新数据
    }),
    timeoutPromise
  ])
    .then(response => {
      console.log('收到响应:', response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`加载帖子失败: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(posts => {
      console.log('获取到帖子数据:', posts);
      // 清除加载状态
      postList.innerHTML = '';
      
      if (!posts || posts.length === 0) {
        // 如果没有帖子，显示提示信息
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = '还没有帖子，来发布第一篇吧！';
        postList.appendChild(emptyMessage);
        return;
      }
      
      // 按日期降序排序（最新的在前）
      posts.sort((a, b) => new Date(b.date || b["日期"]) - new Date(a.date || a["日期"]));
      
      // 添加帖子到页面
      renderPosts(posts, postList);
    })
    .catch(error => {
      console.error('加载帖子错误:', error);
      console.log('使用默认帖子数据');
      
      // 清除加载状态
      postList.innerHTML = '';
      
      // 使用默认数据
      renderPosts(defaultPosts, postList);
      
      // 显示离线模式提示
      const offlineNotice = document.createElement('div');
      offlineNotice.className = 'offline-notice';
      offlineNotice.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 当前为离线模式，显示的是默认帖子。<br>错误信息: ${error.message}`;
      postList.insertBefore(offlineNotice, postList.firstChild);
    });
}

// 渲染帖子列表
function renderPosts(posts, container) {
  // 移除加载提示
  const loadingElement = document.getElementById('loading-message');
  if (loadingElement) {
    loadingElement.remove();
  }
  
  posts.forEach(post => {
    const postItem = document.createElement('div');
    postItem.className = 'post-item';
    const postId = post.ID || post.id; // 兼容大小写差异
    postItem.dataset.id = postId;
    
    // 检查是否为管理员模式
    const isAdmin = window.isAdminMode && window.isAdminMode();
    const deleteButton = isAdmin ? `<button class="delete-btn" onclick="deletePost('${postId}')"><i class="fas fa-trash"></i> 删除</button>` : '';
    
    postItem.innerHTML = `
      <div class="post-header">
        <h3 class="post-title">${post.title || post["标题"] || ''}</h3>
        <div class="post-meta-container">
          <span class="post-meta">${post.date || post["日期"] || ''}</span>
          ${deleteButton}
        </div>
      </div>
      <div class="post-content">${post.content || post["内容"] || ''}</div>
    `;
    
    container.appendChild(postItem);
  });
}

// 管理员功能设置
function setupAdminFeatures() {
  const adminBtn = document.getElementById('admin-btn');
  const adminModal = document.getElementById('admin-modal');
  const closeBtn = adminModal.querySelector('.close');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminStatus = document.getElementById('admin-status');
  
  let isAdminLoggedIn = false;
  let adminToken = null;
  
  // 检查是否已登录
  const savedToken = localStorage.getItem('adminToken');
  if (savedToken) {
    adminToken = savedToken;
    isAdminLoggedIn = true;
    showAdminStatus();
  }
  
  // 管理员按钮点击事件
  adminBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (isAdminLoggedIn) {
      // 已登录，显示退出选项
      if (confirm('您已以管理员身份登录，是否要退出？')) {
        logout();
      }
    } else {
      // 未登录，显示登录模态框
      adminModal.style.display = 'block';
    }
  });
  
  // 关闭模态框
  closeBtn.addEventListener('click', () => {
    adminModal.style.display = 'none';
  });
  
  // 点击模态框外部关闭
  window.addEventListener('click', (e) => {
    if (e.target === adminModal) {
      adminModal.style.display = 'none';
    }
  });
  
  // 登录表单提交
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    
    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const result = await response.json();
      
      if (result.success) {
        adminToken = result.token;
        isAdminLoggedIn = true;
        localStorage.setItem('adminToken', adminToken);
        
        adminModal.style.display = 'none';
        showAdminStatus();
        
        // 重新加载帖子以显示删除按钮
        loadPosts();
        
        alert('登录成功！');
      } else {
        alert(result.message || '登录失败');
      }
    } catch (error) {
      console.error('登录错误:', error);
      alert('登录失败，请检查网络连接');
    }
  });
  
  // 显示管理员状态
  function showAdminStatus() {
    adminStatus.classList.add('show');
    adminBtn.textContent = '退出管理';
    adminBtn.style.color = '#4caf50';
  }
  
  // 退出登录
  function logout() {
    isAdminLoggedIn = false;
    adminToken = null;
    localStorage.removeItem('adminToken');
    
    adminStatus.classList.remove('show');
    adminBtn.textContent = '管理员';
    adminBtn.style.color = '';
    
    // 重新加载帖子隐藏删除按钮
    loadPosts();
    
    alert('已退出管理员模式');
  }
  
  // 删除帖子函数
  window.deletePost = async function(postId) {
    if (!isAdminLoggedIn || !adminToken) {
      alert('请先登录管理员账户');
      return;
    }
    
    if (!confirm('确定要删除这篇帖子吗？此操作不可恢复！')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('帖子已删除');
        loadPosts(); // 重新加载帖子列表
      } else {
        alert(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除错误:', error);
      alert('删除失败，请检查网络连接');
    }
  };
  
  // 检查是否为管理员模式
  window.isAdminMode = function() {
    return isAdminLoggedIn;
  };
}
