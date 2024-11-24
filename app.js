// User management
class UserManager {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('users')) || {};
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    }

    register(username, email, password) {
        if (this.users[email]) {
            throw new Error('Email already registered');
        }

        const user = {
            username,
            email,
            password, // In a real app, this should be hashed
            avatar: `https://source.unsplash.com/100x100/?avatar&${username}`,
            posts: [],
            likes: 0
        };

        this.users[email] = user;
        localStorage.setItem('users', JSON.stringify(this.users));
        this.login(email, password);
    }

    login(email, password) {
        const user = this.users[email];
        if (!user || user.password !== password) {
            throw new Error('Invalid credentials');
        }

        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        return user;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    isLoggedIn() {
        return !!this.currentUser;
    }
}


// Post management
class PostManager {
    constructor() {
        this.posts = JSON.parse(localStorage.getItem('posts')) || [];
    }

    async createPost(content, files, user) {
        const mediaFiles = await Promise.all(
            Array.from(files).map(file => this.processFile(file))
        );

        const post = {
            id: Date.now().toString(),
            content,
            media: mediaFiles,
            author: user.username,
            authorAvatar: user.avatar,
            timestamp: Date.now(),
            likes: 0
        };

        this.posts.unshift(post);
        localStorage.setItem('posts', JSON.stringify(this.posts));
        return post;
    }

    async processFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve({
                    type: file.type.startsWith('image/') ? 'image' : 'video',
                    data: reader.result
                });
            };
            reader.readAsDataURL(file);
        });
    }

    getPosts() {
        return this.posts;
    }

    getUserPosts(username) {
        return this.posts.filter(post => post.author === username);
    }

    likePost(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (post) {
            post.likes++;
            localStorage.setItem('posts', JSON.stringify(this.posts));
        }
    }
}

// UI management
class UI {
    constructor() {
        this.userManager = new UserManager();
        this.postManager = new PostManager();
        this.setupEventListeners();
        this.updateAuthUI();
        this.navigateToHome();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                if (page === 'home') this.navigateToHome();
                if (page === 'profile') this.navigateToProfile();
            });
        });

        // Auth link
        document.getElementById('authLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.userManager.isLoggedIn() ? this.handleLogout() : this.showLoginForm();
        });

        // Main content event delegation
        document.getElementById('main-content').addEventListener('click', (e) => {
            if (e.target.id === 'switchToRegister') this.showRegisterForm();
            if (e.target.id === 'switchToLogin') this.showLoginForm();
            if (e.target.classList.contains('like-button')) {
                this.handleLike(e.target.dataset.postId);
            }
        });
    }

    updateAuthUI() {
        const authLink = document.getElementById('authLink');
        authLink.textContent = this.userManager.isLoggedIn() ? 'Logout' : 'Login';
    }

    // Navigation methods
    navigateToHome() {
        const template = document.getElementById('home-template');
        const content = template.content.cloneNode(true);
        
        if (this.userManager.isLoggedIn()) {
            const form = content.getElementById('createPostForm');
            form.addEventListener('submit', (e) => this.handleCreatePost(e));
            
            const mediaInput = content.getElementById('mediaInput');
            mediaInput.addEventListener('change', (e) => this.handleMediaPreview(e));
        }

        this.renderPosts(content.getElementById('posts-feed'));
        this.setMainContent(content);
    }

    navigateToProfile() {
        if (!this.userManager.isLoggedIn()) {
            this.showLoginForm();
            return;
        }

        const template = document.getElementById('profile-template');
        const content = template.content.cloneNode(true);
        
        const user = this.userManager.currentUser;
        content.getElementById('profileAvatar').src = user.avatar;
        content.getElementById('profileUsername').textContent = user.username;
        
        const userPosts = this.postManager.getUserPosts(user.username);
        content.getElementById('postsCount').textContent = userPosts.length;
        
        const totalLikes = userPosts.reduce((sum, post) => sum + post.likes, 0);
        content.getElementById('likesCount').textContent = totalLikes;

        this.renderPosts(content.getElementById('userPosts'), userPosts);
        this.setMainContent(content);
    }

    // Post handling
    async handleCreatePost(e) {
        e.preventDefault();
        if (!this.userManager.isLoggedIn()) return;

        const form = e.target;
        const content = form.postContent.value;
        const files = form.mediaInput.files;

        try {
            await this.postManager.createPost(content, files, this.userManager.currentUser);
            form.reset();
            document.getElementById('mediaPreview').innerHTML = '';
            this.navigateToHome();
        } catch (error) {
            console.error('Error creating post:', error);
        }
    }

    handleMediaPreview(e) {
        const files = e.target.files;
        const preview = document.getElementById('mediaPreview');
        preview.innerHTML = '';

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const element = file.type.startsWith('image/') 
                    ? document.createElement('img')
                    : document.createElement('video');
                
                element.src = e.target.result;
                if (element.tagName === 'VIDEO') {
                    element.controls = true;
                }
                preview.appendChild(element);
            };
            reader.readAsDataURL(file);
        });
    }

    handleLike(postId) {
        if (!this.userManager.isLoggedIn()) {
            this.showLoginForm();
            return;
        }

        this.postManager.likePost(postId);
        this.navigateToHome();
    }

    // Auth handling
    showLoginForm() {
        const template = document.getElementById('login-template');
        const content = template.content.cloneNode(true);
        
        content.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = e.target.loginEmail.value;
            const password = e.target.loginPassword.value;
            
            try {
                this.userManager.login(email, password);
                this.updateAuthUI();
                this.navigateToHome();
            } catch (error) {
                alert(error.message);
            }
        });

        this.setMainContent(content);
    }

    showRegisterForm() {
        const template = document.getElementById('register-template');
        const content = template.content.cloneNode(true);
        
        content.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = e.target.registerUsername.value;
            const email = e.target.registerEmail.value;
            const password = e.target.registerPassword.value;
            
            try {
                this.userManager.register(username, email, password);
                this.updateAuthUI();
                this.navigateToHome();
            } catch (error) {
                alert(error.message);
            }
        });

        this.setMainContent(content);
    }

    handleLogout() {
        this.userManager.logout();
        this.updateAuthUI();
        this.navigateToHome();
    }

    // Helper methods
    setMainContent(content) {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';
        mainContent.appendChild(content);
    }

    renderPosts(container, posts = null) {
        const allPosts = posts || this.postManager.getPosts();
        container.innerHTML = allPosts.map(post => this.createPostHTML(post)).join('');
    }

    createPostHTML(post) {
        const mediaHTML = post.media.map(media => {
            if (media.type === 'image') {
                return `<img src="${media.data}" alt="Post image">`;
            } else {
                return `<video src="${media.data}" controls></video>`;
            }
        }).join('');

        return `
            <div class="post">
                <div class="post-header">
                    <img src="${post.authorAvatar}" alt="${post.author}" class="post-avatar">
                    <div>
                        <div class="post-user">${post.author}</div>
                        <div class="post-time">${new Date(post.timestamp).toLocaleString()}</div>
                    </div>
                </div>
                <div class="post-content">${post.content}</div>
                ${mediaHTML ? `<div class="post-media">${mediaHTML}</div>` : ''}
                <div class="post-actions">
                    <div class="post-action like-button" data-post-id="${post.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${post.likes > 0 ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        <span>${post.likes}</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize the application
new UI();