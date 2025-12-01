// --- Configuration & Constants ---
const API_CONFIG = {
    LOGIN_URL: "https://learn.zone01oujda.ma/api/auth/signin",
    GRAPHQL_URL: "https://learn.zone01oujda.ma/api/graphql-engine/v1/graphql",
};

const GRAPHQL_QUERY = `{ 
    user {
        login firstName lastName email auditRatio totalUp totalDown
        
        finished_projects: groups(where: {
            group: {status: {_eq: finished}, _and: 
                {eventId: {_eq: 41}}
            }
        }) {
            group { path members { userLogin } }
        }

        transactions_aggregate(where: {eventId: {_eq: 41}, type: {_eq: "xp"}}) {
            aggregate { sum { amount } }
        }
    }
}`;

// --- State Management ---
let currentUser = null;
let userCollaborators = [];
let authToken = null;

// --- DOM Entry Point ---
let appContainer = document.getElementById("app");
if (!appContainer) {
    appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);
}

// --- Services ---

const TokenManager = {
    STORAGE_KEY: "z01Token",

    get() {
        return localStorage.getItem(this.STORAGE_KEY);
    },

    save(token) {
        localStorage.setItem(this.STORAGE_KEY, token);
    },

    remove() {
        localStorage.removeItem(this.STORAGE_KEY);
        authToken = null;
    },

    isValid(token) {
        if (!token) return false;
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            return payload.exp > Date.now() / 1000;
        } catch (e) {
            return false;
        }
    }
};

const AuthService = {
    async login() {
        const usernameInput = document.getElementById('usernameInput');
        const passwordInput = document.getElementById('passwordInput');
        
        const username = usernameInput.value;
        const password = passwordInput.value;

        if (!username || !password) {
            return UIManager.showError('Please enter both username and password');
        }

        const credentials = btoa(`${username}:${password}`);

        try {
            const response = await fetch(API_CONFIG.LOGIN_URL, {
                method: "POST",
                headers: { Authorization: `Basic ${credentials}` }
            });

            if (!response.ok) throw new Error('Invalid credentials');
            
            const token = await response.json();
            TokenManager.save(token);
            authToken = token;
            
            await this.fetchProfile();
            
        } catch (error) {
            console.error("Login Error:", error);
            UIManager.showError('Login failed. Please check your credentials.');
        }
    },

    logout() {
        TokenManager.remove();
        currentUser = null;
        userCollaborators = [];
        UIManager.renderLogin();
    },

    async fetchProfile() {
        try {
            const response = await fetch(API_CONFIG.GRAPHQL_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({ query: GRAPHQL_QUERY })
            });

            if (!response.ok) throw new Error('Failed to fetch user data');
            
            const result = await response.json();
            
            if (!result.data || !result.data.user || result.data.user.length === 0) {
                throw new Error('No user data found');
            }

            const user = result.data.user[0];
            this.processUserData(user);
            UIManager.renderProfile();

        } catch (error) {
            console.error("Profile Fetch Error:", error);
            this.logout();
        }
    },

    processUserData(user) {
        currentUser = {
            userName: user.login,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            auditRatio: user.auditRatio ? parseFloat(user.auditRatio).toFixed(1) : 'N/A',
            totalUp: user.totalUp || 0,
            totalDown: user.totalDown || 0,
            projects: user.finished_projects || [],
            projectCount: user.finished_projects ? user.finished_projects.length : 0,
            formattedXP: user.transactions_aggregate?.aggregate?.sum 
                ? Formatter.formatXP(user.transactions_aggregate.aggregate.sum.amount) 
                : '0 B'
        };

        // Process collaborators
        userCollaborators = [];
        if (currentUser.projects) {
            currentUser.projects.forEach(project => {
                if (project.group?.members) {
                    project.group.members.forEach(member => {
                        if (member.userLogin !== currentUser.userName) {
                            let collab = userCollaborators.find(c => c.name === member.userLogin);
                            if (collab) {
                                collab.count++;
                            } else {
                                userCollaborators.push({ name: member.userLogin, count: 1 });
                            }
                        }
                    });
                }
            });
        }
        userCollaborators.sort((a, b) => b.count - a.count);
    }
};

// --- UI Manager ---

const UIManager = {
    renderLogin() {
        appContainer.innerHTML = `
            <div class="login-container">
                <div class="login-form">
                    <h1>Zone01</h1>
                    <div class="form-group">
                        <input type="text" id="usernameInput" class="form-input" placeholder="Username or Email" required>
                    </div>
                    <div class="form-group">
                        <input type="password" id="passwordInput" class="form-input" placeholder="Password" required>
                    </div>
                    <button type="button" class="primary-button" onclick="AuthService.login()">
                        Sign In
                    </button>
                    <div id="errorMessage" class="error-message"></div>
                </div>
            </div>
        `;
        
        // Add enter key support
        const inputs = appContainer.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') AuthService.login();
            });
        });
    },

    renderProfile() {
        appContainer.innerHTML = `
            <div class="profile-container">
                <div class="profile-header">
                    <div class="profile-info">
                        <h1>${currentUser.firstName} ${currentUser.lastName}</h1>
                        <p>${currentUser.email}</p>
                    </div>
                    <button class="logout-button" onclick="AuthService.logout()">
                        Logout
                    </button>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>Total XP</h3>
                        <div class="stat-value">${currentUser.formattedXP}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Completed Projects</h3>
                        <div class="stat-value">${currentUser.projectCount}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Audit Ratio</h3>
                        <div class="stat-value">${currentUser.auditRatio}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Collaborations</h3>
                        <div class="stat-value">${userCollaborators.length}</div>
                    </div>
                </div>
                
                <div class="chart-container">
                    <h2>Audit Performance</h2>
                    <div class="audit-ratio-container">
                        <div class="audit-ratio-display">${currentUser.auditRatio}</div>
                        <div class="audit-ratio-bar" id="auditRatioBar"></div>
                        <div class="audit-ratio-labels">
                            <span style="color: var(--success)">Given: ${Formatter.formatXP(currentUser.totalUp, 2)}</span>
                            <span style="color: var(--error)">Received: ${Formatter.formatXP(currentUser.totalDown, 2)}</span>
                        </div>
                    </div>
                </div>

                <div class="chart-grid">
                    <div class="chart-container">
                        <h2>Completed Projects</h2>
                        <div class="projects-container">
                            ${currentUser.projects.map(project => `
                                <div class="project-item">
                                    ${Formatter.formatProjectName(project.group.path)}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="chart-container">
                        <h2>Collaboration Network</h2>
                        <div class="chart-section">
                            <div class="chart-info" id="collaborationInfo">
                                Hover over bars to see details
                            </div>
                            <div class="svg-container">
                                <svg id="collaborationChart"></svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render charts after DOM update
        setTimeout(() => {
            this.renderAuditRatioBar();
            this.renderCollaborationChart();
        }, 50);
    },

    renderAuditRatioBar() {
        const total = currentUser.totalUp + currentUser.totalDown;
        const upPercent = total > 0 ? (currentUser.totalUp / total) * 100 : 0;
        const downPercent = total > 0 ? (currentUser.totalDown / total) * 100 : 0;

        const barContainer = document.getElementById('auditRatioBar');
        if (barContainer) {
            barContainer.innerHTML = `
                <svg width="100%" height="30" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <rect x="0" y="0" width="${upPercent}" height="10" fill="var(--success)" rx="1" ry="1"></rect>
                    <rect x="${upPercent}" y="0" width="${downPercent}" height="10" fill="var(--error)" rx="1" ry="1"></rect>
                </svg>
            `;
        }
    },

    renderCollaborationChart() {
        if (userCollaborators.length === 0) return;

        const svg = document.getElementById('collaborationChart');
        if (!svg) return;

        const topCollaborators = userCollaborators.slice(0, 10);
        const maxCount = topCollaborators[0].count;
        const width = 400;
        const height = 250;
        const barWidth = (width / topCollaborators.length) - 5;

        svg.innerHTML = '';
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        topCollaborators.forEach((collaborator, index) => {
            const barHeight = (collaborator.count / maxCount) * (height - 40);
            const x = index * (barWidth + 5);
            const y = height - barHeight - 20;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', barWidth);
            rect.setAttribute('height', barHeight);
            rect.setAttribute('fill', 'var(--accent-primary)');
            rect.setAttribute('rx', '3');
            rect.classList.add('chart-bar');

            rect.addEventListener('mouseenter', () => {
                const info = document.getElementById('collaborationInfo');
                if (info) info.textContent = `${collaborator.name}: ${collaborator.count} projects`;
            });
            
            rect.addEventListener('mouseleave', () => {
                const info = document.getElementById('collaborationInfo');
                if (info) info.textContent = 'Hover over bars to see details';
            });

            svg.appendChild(rect);
        });
    },

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            setTimeout(() => errorElement.textContent = '', 4000);
        }
    }
};

// --- Utilities ---

const Formatter = {
    formatXP(amount, fix = 0) {
        if (amount < 1000) return amount + " B";
        if (amount < 1000000) return (amount / 1000).toFixed(fix) + " kB";
        return (amount / 1000000).toFixed(2) + " MB";
    },

    formatProjectName(path) {
        return path.split('/').pop().replace(/-/g, ' ');
    }
};

// --- Initialization ---

// Expose AuthService globally for HTML onclick handlers
window.AuthService = AuthService;

function initApp() {
    const storedToken = TokenManager.get();
    if (storedToken && TokenManager.isValid(storedToken)) {
        authToken = storedToken;
        AuthService.fetchProfile();
    } else {
        TokenManager.remove();
        UIManager.renderLogin();
    }
}

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
