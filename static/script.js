// ===========================================
// STATE
// ===========================================
let currentTask = '';
let steps = [];
let currentStepIndex = 0;
let completedSteps = 0;
let stepsCollapsed = false;

// ===========================================
// DOM
// ===========================================
const taskInput = document.getElementById('taskInput');
const charCount = document.getElementById('charCount');
const startBtn = document.getElementById('startBtn');

const phaseInput = document.getElementById('phaseInput');
const loadingSection = document.getElementById('loadingSection');
const loadingTitle = document.getElementById('loadingTitle');
const loadingSubtitle = document.getElementById('loadingSubtitle');
const phaseExecution = document.getElementById('phaseExecution');
const phaseFinal = document.getElementById('phaseFinal');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');

const progressCount = document.getElementById('progressCount');
const progressFill = document.getElementById('progressFill');
const currentTaskName = document.getElementById('currentTaskName');
const stepsList = document.getElementById('stepsList');
const stepBadge = document.getElementById('stepBadge');
const stepTitle = document.getElementById('stepTitle');
const stepResult = document.getElementById('stepResult');
const submitStepBtn = document.getElementById('submitStepBtn');
const feedbackCard = document.getElementById('feedbackCard');
const feedbackContent = document.getElementById('feedbackContent');
const feedbackStatus = document.getElementById('feedbackStatus');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const feedbackActions = document.getElementById('feedbackActions');
const finalCard = document.getElementById('finalCard');
const finalContent = document.getElementById('finalContent');

// ===========================================
// CHAR COUNT
// ===========================================
taskInput.addEventListener('input', () => {
    const len = taskInput.value.length;
    charCount.textContent = `${len} character${len !== 1 ? 's' : ''}`;
});

// ===========================================
// EXAMPLE FILL
// ===========================================
function fillExample(el) {
    const text = el.textContent.trim();
    taskInput.value = text;
    taskInput.dispatchEvent(new Event('input'));
    taskInput.focus();
    el.style.background = 'rgba(139, 92, 246, 0.18)';
    setTimeout(() => { el.style.background = ''; }, 400);
}

// ===========================================
// PHASE TRANSITIONS
// ===========================================
function showPhase(phase) {
    phaseInput.style.display = 'none';
    loadingSection.style.display = 'none';
    phaseExecution.style.display = 'none';
    phaseFinal.style.display = 'none';
    errorSection.style.display = 'none';

    if (phase === 'input') phaseInput.style.display = 'block';
    if (phase === 'loading') loadingSection.style.display = 'block';
    if (phase === 'execution') phaseExecution.style.display = 'block';
    if (phase === 'final') phaseFinal.style.display = 'block';
}

// ===========================================
// START TASK
// ===========================================
async function startTask() {
    const task = taskInput.value.trim();
    if (!task) {
        taskInput.focus();
        taskInput.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        setTimeout(() => { taskInput.style.borderColor = ''; }, 1500);
        return;
    }

    currentTask = task;
    currentStepIndex = 0;
    completedSteps = 0;

    showPhase('loading');
    loadingTitle.textContent = 'Generating execution steps...';
    loadingSubtitle.textContent = 'The AI is analyzing your task and crafting a step-by-step plan.';

    try {
        const resp = await fetch('/api/generate-steps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task })
        });
        const data = await resp.json();

        if (!resp.ok) throw new Error(data.error || 'Failed to generate steps.');

        steps = data.steps;
        if (steps.length === 0) throw new Error('No steps were generated. Try a different task.');

        renderExecution();
        showPhase('execution');

    } catch (err) {
        showPhase('input');
        showError(err.message);
    }
}

// ===========================================
// RENDER EXECUTION VIEW
// ===========================================
function renderExecution() {
    // Progress
    updateProgress();

    // Task name
    currentTaskName.textContent = `Task: ${currentTask}`;

    // Steps list
    renderStepsList();

    // Current step
    renderCurrentStep();
}

function updateProgress() {
    const total = steps.length;
    progressCount.textContent = `${completedSteps} / ${total}`;
    const pct = total > 0 ? (completedSteps / total) * 100 : 0;
    progressFill.style.width = `${pct}%`;
}

function renderStepsList() {
    stepsList.innerHTML = '';
    steps.forEach((step, i) => {
        const item = document.createElement('div');
        item.className = 'step-item';
        if (i === currentStepIndex) item.classList.add('active');
        if (i < completedSteps) item.classList.add('completed');

        const dot = document.createElement('div');
        dot.className = 'step-item-dot';

        const text = document.createElement('span');
        text.textContent = step;

        item.appendChild(dot);
        item.appendChild(text);
        stepsList.appendChild(item);
    });
}

function renderCurrentStep() {
    if (currentStepIndex >= steps.length) return;

    const step = steps[currentStepIndex];
    stepBadge.textContent = `STEP ${currentStepIndex + 1}`;
    stepTitle.textContent = step;
    stepResult.value = '';
    submitStepBtn.disabled = false;
    submitStepBtn.querySelector('span').textContent = 'Submit for Review';
    feedbackCard.style.display = 'none';

    // Scroll step card into view
    document.getElementById('stepCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===========================================
// TOGGLE STEPS OVERVIEW
// ===========================================
function toggleStepsOverview() {
    stepsCollapsed = !stepsCollapsed;
    stepsList.classList.toggle('collapsed', stepsCollapsed);
    document.getElementById('toggleSteps').classList.toggle('collapsed', stepsCollapsed);
}

// ===========================================
// SUBMIT STEP
// ===========================================
async function submitStep() {
    const userResult = stepResult.value.trim();
    if (!userResult) {
        stepResult.focus();
        stepResult.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        setTimeout(() => { stepResult.style.borderColor = ''; }, 1500);
        return;
    }

    // Disable button
    submitStepBtn.disabled = true;
    submitStepBtn.querySelector('span').textContent = 'Evaluating...';

    try {
        const resp = await fetch('/api/evaluate-step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task: currentTask,
                step: steps[currentStepIndex],
                user_result: userResult
            })
        });
        const data = await resp.json();

        if (!resp.ok) throw new Error(data.error || 'Evaluation failed.');

        // Show feedback
        showFeedback(data.feedback, data.is_correct);

    } catch (err) {
        showError(err.message);
        submitStepBtn.disabled = false;
        submitStepBtn.querySelector('span').textContent = 'Submit for Review';
    }
}

// ===========================================
// SHOW FEEDBACK
// ===========================================
function showFeedback(html, isCorrect) {
    feedbackCard.style.display = 'block';
    feedbackCard.className = 'feedback-card glass-card ' + (isCorrect ? 'success' : 'failure');
    feedbackCard.style.animation = 'none';
    feedbackCard.offsetHeight; // trigger reflow
    feedbackCard.style.animation = 'fadeInUp 0.4s ease both';

    feedbackContent.innerHTML = html;

    if (isCorrect) {
        statusIcon.textContent = '✅';
        statusText.textContent = 'Step Accepted!';

        feedbackActions.innerHTML = '';

        // Check if this is the last step
        if (currentStepIndex >= steps.length - 1) {
            const finalBtn = document.createElement('button');
            finalBtn.className = 'btn-success';
            finalBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
                <span>Get Final Review</span>`;
            finalBtn.onclick = () => moveToFinalReview();
            feedbackActions.appendChild(finalBtn);
        } else {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-success';
            nextBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12,5 19,12 12,19"/>
                </svg>
                <span>Next Step</span>`;
            nextBtn.onclick = () => goToNextStep();
            feedbackActions.appendChild(nextBtn);
        }
    } else {
        statusIcon.textContent = '❌';
        statusText.textContent = 'Needs Improvement';

        feedbackActions.innerHTML = '';
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-retry';
        retryBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23,4 23,10 17,10"/>
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            <span>Retry This Step</span>`;
        retryBtn.onclick = () => retryStep();
        feedbackActions.appendChild(retryBtn);
    }

    // Scroll feedback into view
    feedbackCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===========================================
// NAVIGATION
// ===========================================
function goToNextStep() {
    completedSteps++;
    currentStepIndex++;
    updateProgress();
    renderStepsList();
    renderCurrentStep();
}

function retryStep() {
    feedbackCard.style.display = 'none';
    stepResult.value = '';
    stepResult.focus();
    submitStepBtn.disabled = false;
    submitStepBtn.querySelector('span').textContent = 'Submit for Review';
    document.getElementById('stepCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===========================================
// FINAL REVIEW
// ===========================================
async function moveToFinalReview() {
    completedSteps = steps.length;
    updateProgress();
    renderStepsList();

    showPhase('final');
    finalCard.style.display = 'none';

    try {
        const resp = await fetch('/api/final-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task: currentTask,
                steps: steps.join('\n')
            })
        });
        const data = await resp.json();

        if (!resp.ok) throw new Error(data.error || 'Review failed.');

        // Update header text
        document.querySelector('.final-header p').textContent = `Here is your mentor's final assessment.`;

        finalContent.innerHTML = data.review;
        finalCard.style.display = 'block';

    } catch (err) {
        showError(err.message);
    }
}

// ===========================================
// START NEW TASK
// ===========================================
function startNewTask() {
    currentTask = '';
    steps = [];
    currentStepIndex = 0;
    completedSteps = 0;
    taskInput.value = '';
    taskInput.dispatchEvent(new Event('input'));
    showPhase('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===========================================
// ERROR
// ===========================================
function showError(msg) {
    errorMessage.textContent = msg;
    errorSection.style.display = 'block';
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
    errorSection.style.display = 'none';
}

// ===========================================
// KEYBOARD SHORTCUTS
// ===========================================
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startTask();
    }
});

// ===========================================
// TOAST
// ===========================================
function showToast(msg) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✓</span> ${msg}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
