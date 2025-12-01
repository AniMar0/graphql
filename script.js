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

    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
        <h1>Welcome, ${state.user.login}</h1>
        <p>ID: ${state.user.id} | Audit Ratio: ${state.user.auditRatio ? state.user.auditRatio.toFixed(1) : 'N/A'}</p>
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
    barChartCard.innerHTML = '<h3>XP Progression</h3>';
    const barChartContainer = document.createElement('div');
    barChartContainer.className = 'chart-container';
    barChartContainer.appendChild(createXPBarChart(state.xpData));
    barChartCard.appendChild(barChartContainer);

    // Pie Chart Container
    const pieChartCard = document.createElement('div');
    pieChartCard.className = 'stat-card';
    pieChartCard.innerHTML = '<h3>Project Pass/Fail Ratio</h3>';
    const pieChartContainer = document.createElement('div');
    pieChartContainer.className = 'chart-container';
    pieChartContainer.appendChild(createPassFailPieChart(state.progressData));
    pieChartCard.appendChild(pieChartContainer);

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

function createXPBarChart(transactions) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 500 300");

    // Process data: Group by month/date to avoid too many bars
    // Or just take the last 20 transactions for simplicity
    const data = transactions.slice(-20);
    if (data.length === 0) return svg;

    const maxVal = Math.max(...data.map(d => d.amount));
    const barWidth = 400 / data.length;
    const gap = 5;
    const chartHeight = 250;
    const startX = 50;
    const startY = 20;

    // Y-Axis Line
    const yAxis = document.createElementNS(svgNS, "line");
    yAxis.setAttribute("x1", startX);
    yAxis.setAttribute("y1", startY);
    yAxis.setAttribute("x2", startX);
    yAxis.setAttribute("y2", startY + chartHeight);
    yAxis.setAttribute("stroke", "#e0e0e0");
    svg.appendChild(yAxis);

    // X-Axis Line
    const xAxis = document.createElementNS(svgNS, "line");
    xAxis.setAttribute("x1", startX);
    xAxis.setAttribute("y1", startY + chartHeight);
    xAxis.setAttribute("x2", startX + 400);
    xAxis.setAttribute("y2", startY + chartHeight);
    xAxis.setAttribute("stroke", "#e0e0e0");
    svg.appendChild(xAxis);

    data.forEach((d, i) => {
        const height = (d.amount / maxVal) * chartHeight;
        const x = startX + i * barWidth + gap;
        const y = startY + chartHeight - height;

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", barWidth - gap);
        rect.setAttribute("height", height);
        rect.setAttribute("class", "bar");

        // Tooltip events
        rect.addEventListener('mousemove', (e) => {
            tooltip.style.display = 'block';
            tooltip.style.left = e.pageX + 10 + 'px';
            tooltip.style.top = e.pageY + 10 + 'px';
            tooltip.innerHTML = `
                <strong>${d.path.split('/').pop()}</strong><br>
                XP: ${d.amount}<br>
                Date: ${new Date(d.createdAt).toLocaleDateString()}
            `;
        });
        rect.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

        svg.appendChild(rect);
    });

    return svg;
}

function createPassFailPieChart(progress) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 300 300");

    const passed = progress.filter(p => p.grade >= 1).length;
    const failed = progress.filter(p => p.grade < 1).length; // Assuming grade < 1 is fail, or maybe just count total vs passed
    // If we only get passed projects from query, we might need to adjust logic.
    // But let's assume the query returns all finished projects.

    const total = passed + failed;
    if (total === 0) {
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", "150");
        text.setAttribute("y", "150");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "white");
        text.textContent = "No Data";
        svg.appendChild(text);
        return svg;
    }

    const data = [
        { label: 'Pass', value: passed, color: '#9ece6a' },
        { label: 'Fail', value: failed, color: '#f7768e' }
    ];

    let startAngle = 0;
    const cx = 150;
    const cy = 150;
    const r = 100;

    data.forEach(slice => {
        if (slice.value === 0) return;

        const sliceAngle = (slice.value / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);

        // Large arc flag
        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

        const pathData = [
            `M ${cx} ${cy}`,
            `L ${x1} ${y1}`,
            `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            `Z`
        ].join(' ');

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pathData);
        path.setAttribute("fill", slice.color);
        path.setAttribute("class", "pie-slice");

        path.addEventListener('mousemove', (e) => {
            tooltip.style.display = 'block';
            tooltip.style.left = e.pageX + 10 + 'px';
            tooltip.style.top = e.pageY + 10 + 'px';
            tooltip.innerHTML = `
                <strong>${slice.label}</strong><br>
                Count: ${slice.value}<br>
                Ratio: ${((slice.value / total) * 100).toFixed(1)}%
            `;
        });
        path.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

        svg.appendChild(path);
        startAngle = endAngle;
    });

    return svg;
}

// Start the app
init();
