// SUPABASE CREDENTIALS AND INITIALIZATION
const SUPABASE_URL = 'https://inovtsxfompeampwgroh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlub3Z0c3hmb21wZWFtcHdncm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTMxMzUsImV4cCI6MjA3NDkyOTEzNX0.MosSJ7VM4KblH6z3okpOuKbwuIH6DbB3_cwtIfXCVBU';

let supabase = null;
let dbConnected = false;

// Inicializar Supabase
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    dbConnected = true;
} catch (error) {
    console.error('Error initializing Supabase:', error);
    dbConnected = false;
}

// Global application state
let currentTheme = 'light';
let companies = [];
let projects = [];
let currentCompanyId = null;
let currentProjectId = null;

// Chart instances
let statusChart = null;
let areaChart = null;

// Initialize application - CORRIGIDO: Aguardar inicialização
document.addEventListener('DOMContentLoaded', async function() {
    await initializeData();
    await loadTheme();
    initializeNavigation();
    initializeDashboard();
    updateDashboard();
    loadCompaniesTable();
    loadProjectsTable();
    updateCompanySelects();
});

// Theme management WITH database persistence
async function loadTheme() {
    if (!dbConnected || !supabase) {
        // Fallback para tema do sistema
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        currentTheme = prefersDark ? 'dark' : 'light';
        applyTheme(currentTheme);
        return;
    }
    
    try {
        // Carregar preferência do banco
        const { data, error } = await supabase
            .from('user_preferences')
            .select('theme')
            .limit(1)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }
        
        if (data && data.theme) {
            currentTheme = data.theme;
        } else {
            // Se não existe no banco, usar preferência do sistema
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            currentTheme = prefersDark ? 'dark' : 'light';
            // Salvar no banco
            await saveThemePreference(currentTheme);
        }
        
        applyTheme(currentTheme);
    } catch (error) {
        console.error('Error loading theme:', error);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        currentTheme = prefersDark ? 'dark' : 'light';
        applyTheme(currentTheme);
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.documentElement.setAttribute('data-color-scheme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        document.documentElement.setAttribute('data-color-scheme', 'light');
    }
    updateThemeIcon(theme === 'dark');
}

async function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    currentTheme = newTheme;
    applyTheme(newTheme);
    await saveThemePreference(newTheme);
}

async function saveThemePreference(theme) {
    if (!dbConnected || !supabase) return;
    
    try {
        // Verificar se já existe uma preferência
        const { data: existing } = await supabase
            .from('user_preferences')
            .select('id')
            .limit(1)
            .single();
        
        if (existing) {
            // Atualizar
            await supabase
                .from('user_preferences')
                .update({ theme, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            // Inserir
            await supabase
                .from('user_preferences')
                .insert([{ theme }]);
        }
    } catch (error) {
        console.error('Error saving theme preference:', error);
    }
}

function updateThemeIcon(isDarkMode) {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// SUPABASE DATABASE FUNCTIONS
async function loadCompaniesFromDB() {
    if (!dbConnected || !supabase) return [];
    
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('id', { ascending: true });
        
        if (error) throw error;
        companies = data || [];
        return companies;
    } catch (error) {
        console.error('Error loading companies:', error);
        showToast('Erro ao carregar empresas do banco: ' + error.message, 'error');
        return [];
    }
}

async function loadProjectsFromDB() {
    if (!dbConnected || !supabase) return [];
    
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('id', { ascending: true });
        
        if (error) throw error;
        projects = data || [];
        return projects;
    } catch (error) {
        console.error('Error loading projects:', error);
        showToast('Erro ao carregar projetos do banco: ' + error.message, 'error');
        return [];
    }
}

async function saveCompanyToDB(companyData, isUpdate = false, id = null) {
    if (!dbConnected || !supabase) {
        if (isUpdate && id) {
            const index = companies.findIndex(c => c.id === id);
            if (index !== -1) {
                companies[index] = { ...companies[index], ...companyData };
                return companies[index];
            }
        } else {
            const newCompany = {
                id: Math.max(...companies.map(c => c.id), 0) + 1,
                ...companyData,
                created_date: new Date().toISOString().split('T')[0]
            };
            companies.push(newCompany);
            return newCompany;
        }
        return null;
    }
    
    try {
        if (isUpdate && id) {
            const { data, error } = await supabase
                .from('companies')
                .update(companyData)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return data[0];
        } else {
            const { data, error } = await supabase
                .from('companies')
                .insert([companyData])
                .select();
            
            if (error) throw error;
            return data[0];
        }
    } catch (error) {
        console.error('Error saving company:', error);
        showToast('Erro ao salvar empresa: ' + error.message, 'error');
        throw error;
    }
}

async function deleteCompanyFromDB(id) {
    if (!dbConnected || !supabase) {
        companies = companies.filter(c => c.id !== id);
        projects = projects.filter(p => p.company_id !== id);
        return true;
    }
    
    try {
        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting company:', error);
        showToast('Erro ao excluir empresa: ' + error.message, 'error');
        throw error;
    }
}

async function saveProjectToDB(projectData, isUpdate = false, id = null) {
    if (!dbConnected || !supabase) {
        if (isUpdate && id) {
            const index = projects.findIndex(p => p.id === id);
            if (index !== -1) {
                projects[index] = { ...projects[index], ...projectData };
                return projects[index];
            }
        } else {
            const newProject = {
                id: Math.max(...projects.map(p => p.id), 0) + 1,
                ...projectData
            };
            projects.push(newProject);
            return newProject;
        }
        return null;
    }
    
    try {
        if (isUpdate && id) {
            const { data, error } = await supabase
                .from('projects')
                .update(projectData)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return data[0];
        } else {
            const { data, error } = await supabase
                .from('projects')
                .insert([projectData])
                .select();
            
            if (error) throw error;
            return data[0];
        }
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Erro ao salvar projeto: ' + error.message, 'error');
        throw error;
    }
}

async function deleteProjectFromDB(id) {
    if (!dbConnected || !supabase) {
        projects = projects.filter(p => p.id !== id);
        return true;
    }
    
    try {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting project:', error);
        showToast('Erro ao excluir projeto: ' + error.message, 'error');
        throw error;
    }
}

// Initialize with data from database or fallback to sample data
async function initializeData() {
    try {
        if (dbConnected) {
            await loadCompaniesFromDB();
            await loadProjectsFromDB();
            
            if (companies.length === 0 && projects.length === 0) {
                showToast('Banco conectado mas vazio. Usando dados de exemplo.', 'info');
                initializeSampleData();
            } else {
                showToast('Dados carregados do banco com sucesso!', 'success');
            }
        } else {
            showToast('Banco não conectado. Usando dados locais.', 'warning');
            initializeSampleData();
        }
    } catch (error) {
        console.error('Error initializing data:', error);
        showToast('Erro ao inicializar dados. Usando dados locais.', 'error');
        initializeSampleData();
    }
}

function initializeSampleData() {
    companies = [
        {
            id: 1,
            name: "Eletrobras",
            cnpj: "00.414.439/0001-56",
            contact: "Patrícia Silva",
            email: "patricia@eletrobras.com.br",
            phone: "(21) 2514-4000",
            address: "Rua da Quitanda, 196 - Centro, Rio de Janeiro/RJ",
            status: "Ativo",
            created_date: "2024-08-01"
        },
        {
            id: 2,
            name: "Petrobras",
            cnpj: "33.000.167/0001-01",
            contact: "João Santos",
            email: "joao.santos@petrobras.com.br",
            phone: "(21) 3224-1234",
            address: "Av. República do Chile, 65 - Centro, Rio de Janeiro/RJ",
            status: "Ativo",
            created_date: "2024-09-15"
        }
    ];

    projects = [
        {
            id: 1,
            company_id: 1,
            name: "Implementação Sistema Auditto",
            description: "Projeto de implementação completa do sistema Auditto para auditoria fiscal",
            owner: "Diego Petri",
            area: "Implantação",
            start_date: "2024-08-26",
            end_date: "2024-11-29",
            status: "Concluída",
            ticket: "",
            notes: "Projeto finalizado com sucesso após GoLive",
            priority: "Alta"
        },
        {
            id: 2,
            company_id: 1,
            name: "Adoção e Melhorias",
            description: "Fase de melhorias pós-implementação",
            owner: "Daniel Neves",
            area: "Produto",
            start_date: "2025-09-02",
            end_date: "2025-09-15",
            status: "Andamento",
            ticket: "PF 5040",
            notes: "Aguardando retorno do cliente para algumas parametrizações",
            priority: "Média"
        },
        {
            id: 3,
            company_id: 2,
            name: "Análise de Viabilidade",
            description: "Estudo preliminar para implementação do sistema",
            owner: "Amanda Barbosa",
            area: "Customer Success",
            start_date: "2024-10-01",
            end_date: "2024-10-31",
            status: "Em Análise",
            ticket: "",
            notes: "Aguardando aprovação da diretoria",
            priority: "Alta"
        }
    ];
}

// Navigation
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('pageTitle');
    const toggleSidebar = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const pageId = link.dataset.page;
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(pageId + 'Page').classList.add('active');
            
            const titles = {
                'dashboard': 'Dashboard',
                'empresas': 'Gestão de Empresas',
                'projetos': 'Gestão de Projetos'
            };
            pageTitle.textContent = titles[pageId] || 'Auditto';
            
            if (pageId === 'dashboard') {
                updateDashboard();
            }
        });
    });

    toggleSidebar?.addEventListener('click', () => {
        sidebar.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggleSidebar.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });
}

// Dashboard functionality
function initializeDashboard() {
    const companyFilter = document.getElementById('companyFilter');
    companyFilter?.addEventListener('change', updateDashboard);
    
    const startDateFilter = document.getElementById('startDateFilter');
    const endDateFilter = document.getElementById('endDateFilter');
    startDateFilter?.addEventListener('change', updateDashboard);
    endDateFilter?.addEventListener('change', updateDashboard);
}

function updateDashboard() {
    updateStatistics();
    updateCharts();
    updateRecentProjects();
    updateCompanySelects();
}

function updateStatistics() {
    const filteredProjects = getFilteredProjects();
    
    document.getElementById('totalCompanies').textContent = companies.length;
    document.getElementById('totalProjects').textContent = filteredProjects.length;
    
    const activeProjects = filteredProjects.filter(p => 
        p.status === 'Andamento' || p.status === 'Em Análise' || p.status === 'Aguardando início'
    ).length;
    
    const completedProjects = filteredProjects.filter(p => p.status === 'Concluída').length;
    
    document.getElementById('activeProjects').textContent = activeProjects;
    document.getElementById('completedProjects').textContent = completedProjects;
}

function updateCharts() {
    const filteredProjects = getFilteredProjects();
    
    const statusData = {};
    filteredProjects.forEach(project => {
        statusData[project.status] = (statusData[project.status] || 0) + 1;
    });

    if (statusChart) {
        statusChart.destroy();
    }
    
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        statusChart = new Chart(statusCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(statusData),
                datasets: [{
                    data: Object.values(statusData),
                    backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    const areaData = {};
    filteredProjects.forEach(project => {
        if (project.area) {
            areaData[project.area] = (areaData[project.area] || 0) + 1;
        }
    });

    if (areaChart) {
        areaChart.destroy();
    }
    
    const areaCtx = document.getElementById('areaChart');
    if (areaCtx) {
        areaChart = new Chart(areaCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(areaData),
                datasets: [{
                    label: 'Projetos',
                    data: Object.values(areaData),
                    backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
}

function updateRecentProjects() {
    const filteredProjects = getFilteredProjects()
        .sort((a, b) => new Date(b.start_date || '1970-01-01') - new Date(a.start_date || '1970-01-01'))
        .slice(0, 5);
    
    const tbody = document.getElementById('recentProjectsTable');
    if (!tbody) return;
    
    tbody.innerHTML = filteredProjects.map(project => {
        const company = companies.find(c => c.id === project.company_id);
        return `
            <tr>
                <td>${project.name}</td>
                <td>${company ? company.name : 'N/A'}</td>
                <td><span class="status-badge ${getStatusClass(project.status)}">${project.status}</span></td>
                <td>${project.area || 'N/A'}</td>
                <td>${formatDate(project.end_date)}</td>
            </tr>
        `;
    }).join('');
}

function getFilteredProjects() {
    const companyFilter = document.getElementById('companyFilter')?.value;
    const startDateFilter = document.getElementById('startDateFilter')?.value;
    const endDateFilter = document.getElementById('endDateFilter')?.value;
    
    return projects.filter(project => {
        let include = true;
        
        if (companyFilter && project.company_id !== parseInt(companyFilter)) {
            include = false;
        }
        
        if (startDateFilter && project.start_date < startDateFilter) {
            include = false;
        }
        
        if (endDateFilter && project.end_date > endDateFilter) {
            include = false;
        }
        
        return include;
    });
}

// Companies management
async function loadCompaniesTable() {
    try {
        if (dbConnected) {
            await loadCompaniesFromDB();
        }
        
        const tbody = document.getElementById('companiesTable');
        if (!tbody) return;
        
        tbody.innerHTML = companies.map(company => `
            <tr>
                <td>${company.name}</td>
                <td>${company.cnpj || 'N/A'}</td>
                <td>${company.contact || 'N/A'}</td>
                <td><span class="status-badge ${company.status === 'Ativo' ? 'concluida' : 'atrasada'}">${company.status}</span></td>
                <td>
                    <button class="btn-action edit" onclick="editCompany(${company.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteCompany(${company.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading companies table:', error);
        showToast('Erro ao carregar tabela de empresas', 'error');
    }
}

function openCompanyModal(id = null) {
    const modal = document.getElementById('companyModal');
    const title = document.getElementById('companyModalTitle');
    const form = document.getElementById('companyForm');
    
    currentCompanyId = id;
    
    if (id) {
        const company = companies.find(c => c.id === id);
        title.textContent = 'Editar Empresa';
        
        document.getElementById('companyId').value = company.id;
        document.getElementById('companyName').value = company.name;
        document.getElementById('companyCnpj').value = company.cnpj || '';
        document.getElementById('companyContact').value = company.contact || '';
        document.getElementById('companyEmail').value = company.email || '';
        document.getElementById('companyPhone').value = company.phone || '';
        document.getElementById('companyAddress').value = company.address || '';
        document.getElementById('companyStatus').value = company.status;
    } else {
        title.textContent = 'Nova Empresa';
        form.reset();
        document.getElementById('companyStatus').value = 'Ativo';
    }
    
    modal.classList.remove('hidden');
}

function closeCompanyModal() {
    document.getElementById('companyModal').classList.add('hidden');
    document.getElementById('companyForm').reset();
    currentCompanyId = null;
}

async function saveCompany() {
    const form = document.getElementById('companyForm');
    if (!form.checkValidity()) {
        showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
        return;
    }
    
    const companyData = {
        name: document.getElementById('companyName').value,
        cnpj: document.getElementById('companyCnpj').value,
        contact: document.getElementById('companyContact').value,
        email: document.getElementById('companyEmail').value,
        phone: document.getElementById('companyPhone').value,
        address: document.getElementById('companyAddress').value,
        status: document.getElementById('companyStatus').value
    };
    
    try {
        if (currentCompanyId) {
            await saveCompanyToDB(companyData, true, currentCompanyId);
            const index = companies.findIndex(c => c.id === currentCompanyId);
            if (index !== -1) {
                companies[index] = { ...companies[index], ...companyData };
            }
            showToast('Empresa atualizada com sucesso!', 'success');
        } else {
            companyData.created_date = new Date().toISOString().split('T')[0];
            const savedCompany = await saveCompanyToDB(companyData);
            
            if (!dbConnected) {
                // Já atualizado no fallback
            } else {
                await loadCompaniesFromDB();
            }
            showToast('Empresa cadastrada com sucesso!', 'success');
        }
        
        await loadCompaniesTable();
        await loadProjectsTable();
        updateAllCompanySelects();
        updateDashboard();
        closeCompanyModal();
    } catch (error) {
        console.error('Error saving company:', error);
        showToast('Erro ao salvar empresa', 'error');
    }
}

function editCompany(id) {
    openCompanyModal(id);
}

async function deleteCompany(id) {
    if (confirm('Tem certeza que deseja excluir esta empresa? Todos os projetos associados também serão removidos.')) {
        try {
            const companyProjects = projects.filter(p => p.company_id === id);
            for (const project of companyProjects) {
                await deleteProjectFromDB(project.id);
            }
            
            await deleteCompanyFromDB(id);
            
            await loadCompaniesTable();
            await loadProjectsTable();
            updateAllCompanySelects();
            updateDashboard();
            showToast('Empresa excluída com sucesso!', 'success');
        } catch (error) {
            console.error('Error deleting company:', error);
            showToast('Erro ao excluir empresa', 'error');
        }
    }
}

// Projects management
async function loadProjectsTable() {
    try {
        if (dbConnected) {
            await loadProjectsFromDB();
        }
        
        const tbody = document.getElementById('projectsTable');
        if (!tbody) return;
        
        tbody.innerHTML = projects.map(project => {
            const company = companies.find(c => c.id === project.company_id);
            return `
                <tr>
                    <td>${project.name}</td>
                    <td>${company ? company.name : 'Empresa não encontrada'}</td>
                    <td><span class="status-badge ${getStatusClass(project.status)}">${project.status}</span></td>
                    <td>${project.area || 'N/A'}</td>
                    <td><span class="priority-badge ${getPriorityClass(project.priority)}">${project.priority}</span></td>
                    <td>${formatDate(project.end_date)}</td>
                    <td>
                        <button class="btn-action edit" onclick="editProject(${project.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action delete" onclick="deleteProject(${project.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading projects table:', error);
        showToast('Erro ao carregar tabela de projetos', 'error');
    }
}

function openProjectModal(id = null) {
    updateAllCompanySelects();
    
    const modal = document.getElementById('projectModal');
    const title = document.getElementById('projectModalTitle');
    const form = document.getElementById('projectForm');
    
    currentProjectId = id;
    
    if (id) {
        const project = projects.find(p => p.id === id);
        title.textContent = 'Editar Projeto';
        
        document.getElementById('projectId').value = project.id;
        document.getElementById('projectCompany').value = project.company_id;
        document.getElementById('projectName').value = project.name;
        document.getElementById('projectDescription').value = project.description || '';
        document.getElementById('projectOwner').value = project.owner || '';
        document.getElementById('projectArea').value = project.area || '';
        document.getElementById('projectStartDate').value = project.start_date || '';
        document.getElementById('projectEndDate').value = project.end_date || '';
        document.getElementById('projectStatus').value = project.status;
        document.getElementById('projectPriority').value = project.priority;
        document.getElementById('projectTicket').value = project.ticket || '';
        document.getElementById('projectNotes').value = project.notes || '';
    } else {
        title.textContent = 'Novo Projeto';
        form.reset();
        document.getElementById('projectStatus').value = 'Aguardando início';
        document.getElementById('projectPriority').value = 'Média';
    }
    
    modal.classList.remove('hidden');
}

function closeProjectModal() {
    document.getElementById('projectModal').classList.add('hidden');
    document.getElementById('projectForm').reset();
    currentProjectId = null;
}

async function saveProject() {
    const form = document.getElementById('projectForm');
    if (!form.checkValidity()) {
        showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
        return;
    }
    
    const projectData = {
        company_id: parseInt(document.getElementById('projectCompany').value),
        name: document.getElementById('projectName').value,
        description: document.getElementById('projectDescription').value,
        owner: document.getElementById('projectOwner').value,
        area: document.getElementById('projectArea').value,
        start_date: document.getElementById('projectStartDate').value,
        end_date: document.getElementById('projectEndDate').value,
        status: document.getElementById('projectStatus').value,
        priority: document.getElementById('projectPriority').value,
        ticket: document.getElementById('projectTicket').value,
        notes: document.getElementById('projectNotes').value
    };
    
    try {
        if (currentProjectId) {
            await saveProjectToDB(projectData, true, currentProjectId);
            const index = projects.findIndex(p => p.id === currentProjectId);
            if (index !== -1) {
                projects[index] = { ...projects[index], ...projectData };
            }
            showToast('Projeto atualizado com sucesso!', 'success');
        } else {
            const savedProject = await saveProjectToDB(projectData);
            
            if (!dbConnected) {
                // Já atualizado no fallback
            } else {
                await loadProjectsFromDB();
            }
            showToast('Projeto cadastrado com sucesso!', 'success');
        }
        
        await loadProjectsTable();
        updateDashboard();
        closeProjectModal();
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Erro ao salvar projeto', 'error');
    }
}

function editProject(id) {
    openProjectModal(id);
}

async function deleteProject(id) {
    if (confirm('Tem certeza que deseja excluir este projeto?')) {
        try {
            await deleteProjectFromDB(id);
            await loadProjectsTable();
            updateDashboard();
            showToast('Projeto excluído com sucesso!', 'success');
        } catch (error) {
            console.error('Error deleting project:', error);
            showToast('Erro ao excluir projeto', 'error');
        }
    }
}

// Utility functions
function updateAllCompanySelects() {
    updateCompanyFilter();
    updateProjectCompanySelect();
}

function updateCompanyFilter() {
    const companyFilter = document.getElementById('companyFilter');
    if (!companyFilter) return;
    
    const currentValue = companyFilter.value;
    const activeCompanies = companies.filter(company => company.status === 'Ativo');
    
    const companyOptions = activeCompanies.map(company => 
        `<option value="${company.id}">${company.name}</option>`
    ).join('');
    
    companyFilter.innerHTML = '<option value="">Todas as Empresas</option>' + companyOptions;
    
    if (currentValue && activeCompanies.some(c => c.id.toString() === currentValue)) {
        companyFilter.value = currentValue;
    }
}

function updateProjectCompanySelect() {
    const projectCompany = document.getElementById('projectCompany');
    if (!projectCompany) return;
    
    const currentValue = projectCompany.value;
    const activeCompanies = companies.filter(company => company.status === 'Ativo');
    
    const companyOptions = activeCompanies.map(company => 
        `<option value="${company.id}">${company.name}</option>`
    ).join('');
    
    projectCompany.innerHTML = '<option value="">Selecione uma empresa</option>' + companyOptions;
    
    if (currentValue && activeCompanies.some(c => c.id.toString() === currentValue)) {
        projectCompany.value = currentValue;
    }
}

function updateCompanySelects() {
    updateAllCompanySelects();
}

function getStatusClass(status) {
    const statusMap = {
        'Concluída': 'concluida',
        'Andamento': 'andamento',
        'Em Análise': 'analise',
        'Aguardando início': 'aguardando',
        'Atrasada': 'atrasada',
        'Declinada': 'declinada'
    };
    return statusMap[status] || 'aguardando';
}

function getPriorityClass(priority) {
    const priorityMap = {
        'Alta': 'alta',
        'Média': 'media',
        'Baixa': 'baixa'
    };
    return priorityMap[priority] || 'media';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Ícones para cada tipo
    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-exclamation-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info: '<i class="fas fa-info-circle"></i>'
    };
    
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 18px;">${icons[type] || icons.info}</span>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; padding: 0; font-size: 16px; opacity: 0.7; transition: opacity 0.2s;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Animação de entrada
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Remover após 5 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Close modals on ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeCompanyModal();
        closeProjectModal();
    }
});

// Close modals on backdrop click
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'companyModal') closeCompanyModal();
        if (e.target.id === 'projectModal') closeProjectModal();
    }
});