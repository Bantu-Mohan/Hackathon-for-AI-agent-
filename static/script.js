// === DOM Elements ===
const taskInput = document.getElementById('taskInput');
const charCount = document.getElementById('charCount');
const generateBtn = document.getElementById('generateBtn');
const loadingSection = document.getElementById('loadingSection');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const resultSection = document.getElementById('resultSection');
const resultContent = document.getElementById('resultContent');

// Raw markdown for copy
let rawResult = '';

// === Character Count ===
taskInput.addEventListener('input', () => {
    const len = taskInput.value.length;
    charCount.textContent = `${len} character${len !== 1 ? 's' : ''}`;
});

// === Fill Example ===
function fillExample(el) {
    const text = el.textContent.trim();
    taskInput.value = text;
    taskInput.dispatchEvent(new Event('input'));
    taskInput.focus();
    // Brief highlight
    el.style.background = 'rgba(139, 92, 246, 0.18)';
    setTimeout(() => { el.style.background = ''; }, 400);
}

// === Loading Step Animation ===
let loadingInterval = null;
function startLoadingAnimation() {
    const steps = ['step1', 'step2', 'step3'];
    let idx = 0;

    // Reset all
    steps.forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById(steps[0]).classList.add('active');

    loadingInterval = setInterval(() => {
        idx = (idx + 1) % steps.length;
        steps.forEach(id => document.getElementById(id).classList.remove('active'));
        document.getElementById(steps[idx]).classList.add('active');
    }, 2500);
}

function stopLoadingAnimation() {
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
}

// === Generate Plan ===
async function generatePlan() {
    const task = taskInput.value.trim();
    if (!task) {
        taskInput.focus();
        taskInput.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        setTimeout(() => { taskInput.style.borderColor = ''; }, 1500);
        return;
    }

    // Show loading
    hideError();
    resultSection.style.display = 'none';
    loadingSection.style.display = 'block';
    generateBtn.disabled = true;
    generateBtn.querySelector('span').textContent = 'Generating...';
    startLoadingAnimation();

    // Smooth scroll to loading
    loadingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const resp = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task })
        });

        const data = await resp.json();

        if (!resp.ok) {
            throw new Error(data.error || 'Failed to generate plan.');
        }

        // Show result
        rawResult = data.raw || '';
        resultContent.innerHTML = data.result;
        loadingSection.style.display = 'none';
        resultSection.style.display = 'block';

        // Animate result into view
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        loadingSection.style.display = 'none';
        showError(err.message);
    } finally {
        stopLoadingAnimation();
        generateBtn.disabled = false;
        generateBtn.querySelector('span').textContent = 'Generate Plan';
    }
}

// === Error Handling ===
function showError(msg) {
    errorMessage.textContent = msg;
    errorSection.style.display = 'block';
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
    errorSection.style.display = 'none';
}

// === Copy to Clipboard ===
async function copyResult() {
    try {
        await navigator.clipboard.writeText(rawResult || resultContent.innerText);
        showToast('Copied to clipboard!');
    } catch {
        showToast('Failed to copy.');
    }
}

function showToast(msg) {
    // Remove old toast
    const old = document.querySelector('.toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✓</span> ${msg}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// === New Task ===
function newTask() {
    resultSection.style.display = 'none';
    taskInput.value = '';
    taskInput.dispatchEvent(new Event('input'));
    taskInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === Enter Key Shortcut ===
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generatePlan();
    }
});
