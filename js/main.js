// 静态版本 - 使用localStorage存储数据

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
      
      // 创建新帖子对象
      const newPost = {
        id: Date.now().toString(), // 使用时间戳作为ID
        title: title,
        content: content,
        date: new Date().toLocaleString('zh-CN')
      };
      
      // 从 localStorage 获取现有帖子
      const savedPosts = localStorage.getItem('posts');
      let posts = [];
      
      if (savedPosts) {
        try {
          posts = JSON.parse(savedPosts);
        } catch (error) {
          console.error('解析帖子数据失败:', error);
          posts = [];
        }
      }
      
      // 添加新帖子到数组开头
      posts.unshift(newPost);
      
      // 保存到 localStorage
      localStorage.setItem('posts', JSON.stringify(posts));
      
      // 清空表单
      postForm.reset();
      
      // 恢复按钮状态
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      
      // 重新加载帖子列表
      loadPosts();
      
      alert('发布成功！');
    });
  }
  
  // 管理员功能
  setupAdminFeatures();
  
  // 加载帖子
  loadPosts();
});

// 从 localStorage 加载帖子
function loadPosts() {
  const postList = document.getElementById('post-list');
  if (!postList) return;
  
  // 清空列表
  postList.innerHTML = '';
  
  // 从 localStorage 获取帖子
  const savedPosts = localStorage.getItem('posts');
  let posts = [];
  
  if (savedPosts) {
    try {
      posts = JSON.parse(savedPosts);
    } catch (error) {
      console.error('解析帖子数据失败:', error);
      posts = defaultPosts;
    }
  } else {
    // 如果没有本地数据，使用默认数据
    posts = defaultPosts;
    localStorage.setItem('posts', JSON.stringify(posts));
  }
  
  if (posts && posts.length > 0) {
    renderPosts(posts, postList);
  } else {
    // 显示空列表提示
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.innerHTML = '<p>还没有帖子，<a href="#post-form">去发布一篇</a>吧！</p>';
    postList.appendChild(emptyMessage);
  }
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
  const savedLoginStatus = localStorage.getItem('adminLoggedIn');
  if (savedToken && savedLoginStatus === 'true') {
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
    
    // 静态版本 - 简单的用户名密码验证
    if (username === 'admin' && password === 'yui2025') {
      adminToken = 'static-admin-token-' + Date.now();
      isAdminLoggedIn = true;
      localStorage.setItem('adminToken', adminToken);
      localStorage.setItem('adminLoggedIn', 'true');
      
      adminModal.style.display = 'none';
      showAdminStatus();
      
      // 重新加载帖子以显示删除按钮
      loadPosts();
      
      alert('登录成功！');
    } else {
      alert('用户名或密码错误！');
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
    localStorage.removeItem('adminLoggedIn');
    
    adminStatus.classList.remove('show');
    adminBtn.textContent = '管理员';
    adminBtn.style.color = '';
    
    // 重新加载帖子隐藏删除按钮
    loadPosts();
    
    alert('已退出管理员模式');
  }
  
  // 删除帖子函数
  window.deletePost = function(postId) {
    if (!isAdminLoggedIn || !adminToken) {
      alert('请先登录管理员账户');
      return;
    }
    
    if (!confirm('确定要删除这篇帖子吗？此操作不可恢复！')) {
      return;
    }
    
    // 从 localStorage 获取帖子数据
    const savedPosts = localStorage.getItem('posts');
    if (!savedPosts) {
      alert('没有找到帖子数据');
      return;
    }
    
    try {
      let posts = JSON.parse(savedPosts);
      
      // 过滤掉要删除的帖子
      const originalLength = posts.length;
      posts = posts.filter(post => (post.id || post.ID) !== postId);
      
      if (posts.length === originalLength) {
        alert('未找到要删除的帖子');
        return;
      }
      
      // 保存更新后的数据
      localStorage.setItem('posts', JSON.stringify(posts));
      
      // 重新加载帖子列表
      loadPosts();
      
      alert('帖子已删除');
    } catch (error) {
      console.error('删除帖子错误:', error);
      alert('删除失败，数据解析错误');
    }
  };
  
  // 检查是否为管理员模式
  window.isAdminMode = function() {
    return isAdminLoggedIn;
  };
}
