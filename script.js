// Configuration
const DOMAIN = 'learn.zone01oujda.ma'; // Change this to your specific domain
const AUTH_URL = `https://${DOMAIN}/api/auth/signin`;
const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

// State
let state = {
    token: localStorage.getItem('jwt'),
    user: null,
    xpData: [],
    progressData: []
};

// DOM Entry Point
const root = document.createElement('div');
root.id = 'app';
document.body.appendChild(root);

// Tooltip for charts
const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
document.body.appendChild(tooltip);

// Global Event Listeners for Tooltips (Delegation)
document.body.addEventListener('mouseover', (e) => {
    const target = e.target;
    if (target.classList.contains('bar')) {
        const name = target.getAttribute('data-name');
        const xp = target.getAttribute('data-xp');
        const date = target.getAttribute('data-date');
        
        tooltip.style.display = 'block';
        tooltip.innerHTML = `
            <strong>${name}</strong><br>
            XP: ${xp}<br>
            Date: ${date}
        `;
    } else if (target.classList.contains('pie-slice')) {
        const label = target.getAttribute('data-label');
        const count = target.getAttribute('data-count');
        const ratio = target.getAttribute('data-ratio');

        tooltip.style.display = 'block';
        tooltip.innerHTML = `
            <strong>${label}</strong><br>
            Count: ${count}<br>
            Ratio: ${ratio}%
        `;
    }
});

document.body.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
        tooltip.style.left = e.pageX + 10 + 'px';
        tooltip.style.top = e.pageY + 10 + 'px';
    }
});

document.body.addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('bar') || e.target.classList.contains('pie-slice')) {
        tooltip.style.display = 'none';
    }
});

// Initialize
function init() {
    if (state.token) {
        renderProfile();
    } else {
        renderLogin();
    }
}

// --- Login Section ---

function renderLogin() {
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'login-container';

    const form = document.createElement('form');
    form.className = 'login-form';

    const title = document.createElement('h2');
    title.textContent = 'Student Login';

    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Username or Email';
    usernameInput.required = true;

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password';
    passwordInput.required = true;

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Login';

    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';

    form.appendChild(title);
    form.appendChild(usernameInput);
    form.appendChild(passwordInput);
    form.appendChild(submitBtn);
    form.appendChild(errorMsg);
    container.appendChild(form);
    root.appendChild(container);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = 'Logging in...';

        const credentials = btoa(`${usernameInput.value}:${passwordInput.value}`);

        try {
            const response = await fetch(AUTH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Invalid credentials');
            }

            const data = await response.json();
            state.token = data; // The endpoint usually returns the token string directly or in an object
            // Adjust based on actual API response. Usually it's just the string (JWT)
            // If it returns { "token": "..." } use data.token. 
            // Based on standard 01 platform, it returns a string in double quotes.

            // Let's handle both cases safely
            const token = typeof data === 'string' ? data : data.token || data;

            localStorage.setItem('jwt', token);
            state.token = token;
            renderProfile();
        } catch (err) {
            errorMsg.textContent = err.message;
        }
    });
}

// --- Profile Section ---

async function renderProfile() {
    root.innerHTML = '<div style="text-align:center; margin-top: 50px;">Loading profile data...</div>';

    const query = `
    {
        user {
            id
            login
            totalUp
            totalDown
            auditRatio
        }
        transaction(where: {type: {_eq: "xp"}}, order_by: {createdAt: asc}) {
            amount
            createdAt
            path
        }
        progress(where: {isDone: {_eq: true}, object: {type: {_eq: "project"}}}) {
            grade
            path
            object {
                name
            }
        }
    }
    `;

    try {
        const data = await fetchGraphQL(query);

        if (!data.user || data.user.length === 0) {
            throw new Error('User data not found');
        }

        state.user = data.user[0];
        state.xpData = data.transaction;
        state.progressData = data.progress;

        renderDashboard();
    } catch (err) {
        console.error(err);
        root.innerHTML = `
            <div class="login-container">
                <div class="login-form" style="text-align:center;">
                    <h3 style="color:var(--error-color)">Error Loading Data</h3>
                    <p>${err.message}</p>
                    <button onclick="logout()">Logout</button>
                </div>
            </div>
        `;
    }
}

async function fetchGraphQL(query, variables = {}) {
    const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors[0].message);
    }
    return result.data;
}

function logout() {
    localStorage.removeItem('jwt');
    state.token = null;
    state.user = null;
    renderLogin();
}

function renderDashboard() {
    root.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'profile-header';
    
    // Calculate Audit Ratio percentages
    const totalAudit = state.user.totalUp + state.user.totalDown;
    const upPercent = totalAudit ? (state.user.totalUp / totalAudit) * 100 : 0;
    const downPercent = totalAudit ? (state.user.totalDown / totalAudit) * 100 : 0;
    const auditRatio = state.user.auditRatio ? state.user.auditRatio.toFixed(1) : 'N/A';

    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
        <h1>Welcome, ${state.user.login}</h1>
        <p>ID: ${state.user.id} | Audit Ratio: ${auditRatio}</p>
        <div id="auditRatioBar" style="margin-top: 10px; width: 300px;">
            <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none" style="border-radius: 5px; overflow: hidden;">
                <rect x="0" y="0" width="${upPercent}" height="10" fill="var(--success-color)"></rect>
                <rect x="${upPercent}" y="0" width="${downPercent}" height="10" fill="var(--error-color)"></rect>
            </svg>
            <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-top: 5px;">
                <span>Done: ${(state.user.totalUp / 1000000).toFixed(2)} MB</span>
                <span>Received: ${(state.user.totalDown / 1000000).toFixed(2)} MB</span>
            </div>
        </div>
    `;

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = logout;

    header.appendChild(userInfo);
    header.appendChild(logoutBtn);
    root.appendChild(header);

    // Stats Grid
    const grid = document.createElement('div');
    grid.className = 'stats-grid';

    // Total XP Card
    const totalXP = state.xpData.reduce((acc, curr) => acc + curr.amount, 0);
    const xpCard = createStatCard('Total XP', `${(totalXP / 1000).toFixed(0)} kB`);
    
    // Projects Passed Card
    const passedProjects = state.progressData.filter(p => p.grade >= 1).length;
    const projectCard = createStatCard('Projects Passed', passedProjects);

    grid.appendChild(xpCard);
    grid.appendChild(projectCard);
    root.appendChild(grid);

    // Charts Section
    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'stats-grid';

    // Bar Chart Container
    const barChartCard = document.createElement('div');
    barChartCard.className = 'stat-card';
    barChartCard.innerHTML = `
        <h3>XP Progression</h3>
        <div class="chart-container">
            ${createXPBarChartString(state.xpData)}
        </div>
    `;

    // Pie Chart Container
    const pieChartCard = document.createElement('div');
    pieChartCard.className = 'stat-card';
    pieChartCard.innerHTML = `
        <h3>Project Pass/Fail Ratio</h3>
        <div class="chart-container">
            ${createPassFailPieChartString(state.progressData)}
        </div>
    `;

    chartsGrid.appendChild(barChartCard);
    chartsGrid.appendChild(pieChartCard);
    root.appendChild(chartsGrid);
}

function createStatCard(title, value) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
        <h3>${title}</h3>
        <div style="font-size: 2em; font-weight: bold; color: var(--primary-color);">${value}</div>
    `;
    return card;
}

// --- SVG Charts ---

function createXPBarChartString(transactions) {
    // Process data: Group by month/date to avoid too many bars
    // Or just take the last 20 transactions for simplicity
    const data = transactions.slice(-20); 
    if (data.length === 0) return '<svg></svg>';

    const maxVal = Math.max(...data.map(d => d.amount));
    const barWidth = 400 / data.length;
    const gap = 5;
    const chartHeight = 250;
    const startX = 50;
    const startY = 20;

    let barsHtml = '';
    data.forEach((d, i) => {
        const height = (d.amount / maxVal) * chartHeight;
        const x = startX + i * barWidth + gap;
        const y = startY + chartHeight - height;
        const projectName = d.path.split('/').pop();
        const date = new Date(d.createdAt).toLocaleDateString();

        barsHtml += `<rect 
            x="${x}" 
            y="${y}" 
            width="${barWidth - gap}" 
            height="${height}" 
            class="bar" 
            data-name="${projectName}" 
            data-xp="${d.amount}" 
            data-date="${date}"
        ></rect>`;
    });

    return `
        <svg viewBox="0 0 500 300">
            <line x1="${startX}" y1="${startY}" x2="${startX}" y2="${startY + chartHeight}" stroke="#e0e0e0"></line>
            <line x1="${startX}" y1="${startY + chartHeight}" x2="${startX + 400}" y2="${startY + chartHeight}" stroke="#e0e0e0"></line>
            ${barsHtml}
        </svg>
    `;
}

function createPassFailPieChartString(progress) {
    const passed = progress.filter(p => p.grade >= 1).length;
    const failed = progress.filter(p => p.grade < 1).length;
    const total = passed + failed;

    if (total === 0) {
        return `<svg viewBox="0 0 300 300"><text x="150" y="150" text-anchor="middle" fill="white">No Data</text></svg>`;
    }

    const data = [
        { label: 'Pass', value: passed, color: '#9ece6a' },
        { label: 'Fail', value: failed, color: '#f7768e' }
    ];

    let startAngle = 0;
    const cx = 150;
    const cy = 150;
    const r = 100;
    let pathsHtml = '';

    data.forEach(slice => {
        if (slice.value === 0) return;

        const sliceAngle = (slice.value / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);

        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

        const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        
        const ratio = ((slice.value / total) * 100).toFixed(1);

        pathsHtml += `<path 
            d="${pathData}" 
            fill="${slice.color}" 
            class="pie-slice"
            data-label="${slice.label}"
            data-count="${slice.value}"
            data-ratio="${ratio}"
        ></path>`;

        startAngle = endAngle;
    });

    return `<svg viewBox="0 0 300 300">${pathsHtml}</svg>`;
}

// Start the app
init();
