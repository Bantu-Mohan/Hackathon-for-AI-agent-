// =============================================
// AI Task Execution Agent — Dashboard Logic
// =============================================

// --- STATE ---
let currentTask = '';
let currentTaskId = null;
let steps = [];
let stepDbIds = [];
let currentStepIndex = 0;
let completedSteps = 0;
let stepsStatus = []; // 'pending' | 'completed' | 'retry'
let mistakeLog = [];
let planCollapsed = false;
let mistakeCollapsed = false;
let currentSession = null;

// --- DOM ---
const taskInput = document.getElementById('taskInput');
const charCount = document.getElementById('charCount');

const phaseInput = document.getElementById('phaseInput');
const loadingSection = document.getElementById('loadingSection');
const loadingTitle = document.getElementById('loadingTitle');
const loadingSubtitle = document.getElementById('loadingSubtitle');
const phaseExecution = document.getElementById('phaseExecution');
const phaseFinal = document.getElementById('phaseFinal');
const phaseHistory = document.getElementById('phaseHistory');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');

const progressPercentage = document.getElementById('progressPercentage');
const progressFill = document.getElementById('progressFill');
const progressCount = document.getElementById('progressCount');
const sidebarSteps = document.getElementById('sidebarSteps');

const stepBadge = document.getElementById('stepBadge');
const stepExecTitle = document.getElementById('stepExecTitle');
const stepExplanation = document.getElementById('stepExplanation');
const stepResult = document.getElementById('stepResult');
const submitStepBtn = document.getElementById('submitStepBtn');
const feedbackCard = document.getElementById('feedbackCard');
const feedbackContent = document.getElementById('feedbackContent');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const feedbackActions = document.getElementById('feedbackActions');
const finalCard = document.getElementById('finalCard');
const finalContent = document.getElementById('finalContent');
const stepsPlanList = document.getElementById('stepsPlanList');
const mistakeList = document.getElementById('mistakeList');
const mistakeCount = document.getElementById('mistakeCount');

// --- INIT ---
(async function init() {
    currentSession = await requireAuth();
    if (!currentSession) return;

    // Display user email
    const email = currentSession.user.email || 'User';
    document.getElementById('userEmailText').textContent = email;
})();

// Char count
taskInput.addEventListener('input', () => {
    const len = taskInput.value.length;
    charCount.textContent = `${len} character${len !== 1 ? 's' : ''}`;
});

// Fill example
function fillExample(el) {
    const text = el.textContent.trim();
    taskInput.value = text;
    taskInput.dispatchEvent(new Event('input'));
    taskInput.focus();
    el.style.background = 'rgba(139, 92, 246, 0.18)';
    setTimeout(() => { el.style.background = ''; }, 400);
}

// --- PHASE TRANSITIONS ---
function showPhase(phase) {
    phaseInput.style.display = 'none';
    loadingSection.style.display = 'none';
    phaseExecution.style.display = 'none';
    phaseFinal.style.display = 'none';
    phaseHistory.style.display = 'none';
    errorSection.style.display = 'none';

    if (phase === 'input') phaseInput.style.display = 'block';
    if (phase === 'loading') loadingSection.style.display = 'block';
    if (phase === 'execution') phaseExecution.style.display = 'block';
    if (phase === 'final') phaseFinal.style.display = 'block';
    if (phase === 'history') phaseHistory.style.display = 'block';
}

// --- HISTORY VIEW ---
function toggleHistoryView() {
    showPhase('history');
    fetchHistory();
}

async function fetchHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<div class="loading-spinner" style="width: 30px; height: 30px;"><div class="spinner-ring"></div></div>';

    if (!supabaseClient || !currentSession) {
        historyList.innerHTML = '<p class="history-empty">Not logged in or Supabase not configured.</p>';
        return;
    }

    try {
        // Fetch tasks
        const { data: tasks, error: tasksError } = await supabaseClient
            .from('users_tasks')
            .select(`
                id, task, created_at,
                task_steps(id, status)
            `)
            .eq('user_id', currentSession.user.id)
            .order('created_at', { ascending: false });

        if (tasksError) throw tasksError;

        if (!tasks || tasks.length === 0) {
            historyList.innerHTML = '<p class="history-empty">You haven\'t started any tasks yet.</p>';
            return;
        }

        historyList.innerHTML = '';

        tasks.forEach(taskObj => {
            const steps = taskObj.task_steps || [];
            const totalSteps = steps.length;
            const completed = steps.filter(s => s.status === 'completed').length;
            const pct = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
            const dateStr = new Date(taskObj.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const card = document.createElement('div');
            card.className = 'history-card glass-card';

            card.innerHTML = `
                <div class="history-card-header">
                    <h4 class="history-card-title">${taskObj.task}</h4>
                    <span class="history-card-date">${dateStr}</span>
                </div>
                <div class="history-progress-container">
                    <div class="history-progress-bar-bg">
                        <div class="history-progress-fill" style="width: ${pct}%"></div>
                    </div>
                    <div class="history-progress-text">${pct}%</div>
                </div>
                <div class="history-card-actions" style="margin-top: 16px; text-align: right;">
                    <button class="btn-secondary" onclick="resumeTask('${taskObj.id}')" style="padding: 6px 14px; font-size: 0.85rem;">
                        ${pct === 100 ? 'View Final Review' : 'Continue Task'}
                    </button>
                </div>
            `;
            historyList.appendChild(card);
        });

    } catch (err) {
        console.error('Fetch history error:', err);
        historyList.innerHTML = '<p class="history-empty" style="color:var(--accent-red)">Failed to load history.</p>';
    }
}

// --- RESUME TASK ---
window.resumeTask = async function (taskId) {
    if (!supabaseClient) return;

    showPhase('loading');
    loadingTitle.textContent = 'Loading task...';
    loadingSubtitle.textContent = 'Fetching your previous progress from the database.';

    try {
        const { data: taskData, error: taskError } = await supabaseClient
            .from('users_tasks')
            .select(`
                id, task,
                task_steps(id, step_number, step_title, explanation, status)
            `)
            .eq('id', taskId)
            .single();

        if (taskError) throw taskError;
        if (!taskData.task_steps || taskData.task_steps.length === 0) {
            throw new Error("No steps found for this task.");
        }

        currentTask = taskData.task;
        currentTaskId = taskData.id;

        // Sort ascending by step_number
        const sortedSteps = taskData.task_steps.sort((a, b) => a.step_number - b.step_number);

        steps = sortedSteps.map(s => ({ title: s.step_title, explanation: s.explanation }));
        stepDbIds = sortedSteps.map(s => s.id);
        stepsStatus = sortedSteps.map(s => s.status);

        completedSteps = stepsStatus.filter(s => s === 'completed').length;

        let nextIndex = stepsStatus.findIndex(s => s !== 'completed');
        mistakeLog = []; // Reset mistake log for the new session

        if (nextIndex === -1) {
            // All completed
            currentStepIndex = steps.length - 1;
            renderExecution();
            showPhase('final');
            finalCard.style.display = 'block';
            finalContent.innerHTML = '<p style="font-size:1.1rem; color:var(--text-primary); text-align:center;">You have already successfully completed all steps for this task!</p>';
            return;
        }

        currentStepIndex = nextIndex;
        renderExecution();
        showPhase('execution');

    } catch (e) {
        console.error("Resume error:", e);
        showPhase('history');
        showError("Failed to resume task: " + e.message);
    }
}

// --- START TASK ---
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
    steps = [];
    stepDbIds = [];
    stepsStatus = [];
    mistakeLog = [];
    currentTaskId = null;

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

        stepsStatus = steps.map(() => 'pending');

        // Save task to Supabase
        await saveTaskToSupabase(task, steps);

        renderExecution();
        showPhase('execution');

    } catch (err) {
        showPhase('input');
        showError(err.message);
    }
}

// --- SAVE TO SUPABASE ---
async function saveTaskToSupabase(task, steps) {
    if (!supabaseClient) {
        console.warn('Supabase not configured. Skipping DB save.');
        return;
    }

    try {
        // Insert task
        const { data: taskData, error: taskError } = await supabaseClient
            .from('users_tasks')
            .insert({ user_id: currentSession.user.id, task: task })
            .select()
            .single();

        if (taskError) {
            console.warn('Could not save task to Supabase:', taskError.message);
            return;
        }

        currentTaskId = taskData.id;

        // Insert steps
        const stepRows = steps.map((s, i) => ({
            task_id: currentTaskId,
            step_number: i + 1,
            step_title: s.title || s,
            explanation: s.explanation || '',
            status: 'pending'
        }));

        const { data: stepsData, error: stepsError } = await supabaseClient
            .from('task_steps')
            .insert(stepRows)
            .select();

        if (stepsError) {
            console.warn('Could not save steps to Supabase:', stepsError.message);
        } else {
            stepDbIds = stepsData.map(s => s.id);
        }
    } catch (e) {
        console.warn('Supabase save error:', e);
    }
}

async function saveSubmissionToSupabase(stepIndex, userInput, aiFeedback, isCorrect) {
    if (!supabaseClient) return;
    try {
        if (!stepDbIds[stepIndex]) return;
        await supabaseClient.from('step_submissions').insert({
            step_id: stepDbIds[stepIndex],
            user_input: userInput,
            ai_feedback: aiFeedback,
            is_correct: isCorrect
        });

        // Update step status
        const newStatus = isCorrect ? 'completed' : 'retry';
        await supabaseClient.from('task_steps')
            .update({ status: newStatus })
            .eq('id', stepDbIds[stepIndex]);
    } catch (e) {
        console.warn('Supabase submission save error:', e);
    }
}

// --- RENDER EXECUTION ---
function renderExecution() {
    updateProgress();
    renderStepsPlan();
    renderSidebarSteps();
    renderCurrentStep();
}

function updateProgress() {
    const total = steps.length;
    progressCount.textContent = `${completedSteps} / ${total} steps`;
    const pct = total > 0 ? Math.round((completedSteps / total) * 100) : 0;
    progressPercentage.textContent = `${pct}%`;
    progressFill.style.width = `${pct}%`;
}

function renderStepsPlan() {
    stepsPlanList.innerHTML = '';
    steps.forEach((step, i) => {
        const card = document.createElement('div');
        card.className = 'plan-step-card';

        const number = document.createElement('span');
        number.className = 'plan-step-number';
        number.textContent = `Step ${i + 1}`;

        const title = document.createElement('div');
        title.className = 'plan-step-title';
        title.textContent = step.title || step;

        const explanation = document.createElement('div');
        explanation.className = 'plan-step-explanation';
        explanation.textContent = step.explanation || '';

        card.appendChild(number);
        card.appendChild(title);
        if (step.explanation) card.appendChild(explanation);

        if (step.substeps && step.substeps.length > 0) {
            const substepsList = document.createElement('ul');
            substepsList.className = 'plan-substeps-list';
            step.substeps.forEach(sub => {
                const li = document.createElement('li');
                li.textContent = sub;
                substepsList.appendChild(li);
            });
            card.appendChild(substepsList);
        }

        stepsPlanList.appendChild(card);
    });
}

function renderSidebarSteps() {
    sidebarSteps.innerHTML = '';
    steps.forEach((step, i) => {
        const item = document.createElement('div');
        item.className = 'sidebar-step';
        if (i === currentStepIndex && stepsStatus[i] !== 'completed') item.classList.add('active');
        if (stepsStatus[i] === 'completed') item.classList.add('completed');
        if (stepsStatus[i] === 'retry') item.classList.add('retry');

        const icon = document.createElement('span');
        icon.className = 'sidebar-step-icon';
        if (stepsStatus[i] === 'completed') icon.textContent = '✔';
        else if (stepsStatus[i] === 'retry') icon.textContent = '❌';
        else if (i === currentStepIndex) icon.textContent = '▶';
        else icon.textContent = '⏳';

        const text = document.createElement('span');
        text.className = 'sidebar-step-text';
        text.textContent = step.title || step;

        item.appendChild(icon);
        item.appendChild(text);
        sidebarSteps.appendChild(item);
    });
}

function renderCurrentStep() {
    if (currentStepIndex >= steps.length) return;

    const step = steps[currentStepIndex];
    stepBadge.textContent = `STEP ${currentStepIndex + 1}`;
    stepExecTitle.textContent = step.title || step;

    let expHtml = `<p>${step.explanation || 'Complete this step and describe what you did.'}</p>`;

    // Add substeps if they exist
    if (step.substeps && step.substeps.length > 0) {
        expHtml += `<ul class="exec-substeps-list">`;
        step.substeps.forEach(sub => {
            expHtml += `<li>${sub}</li>`;
        });
        expHtml += `</ul>`;
    }

    stepExplanation.innerHTML = expHtml;

    stepResult.value = '';
    submitStepBtn.disabled = false;
    submitStepBtn.querySelector('span').textContent = 'Submit Step';
    feedbackCard.style.display = 'none';

    document.getElementById('stepExecCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- TOGGLE PANELS ---
function togglePlanView() {
    planCollapsed = !planCollapsed;
    stepsPlanList.classList.toggle('collapsed', planCollapsed);
    document.getElementById('togglePlan').classList.toggle('collapsed', planCollapsed);
}

function toggleMistakeLog() {
    mistakeCollapsed = !mistakeCollapsed;
    mistakeList.classList.toggle('collapsed', mistakeCollapsed);
    document.getElementById('mistakeToggle').classList.toggle('collapsed', mistakeCollapsed);
}

// --- SUBMIT STEP ---
async function submitStep() {
    const userResult = stepResult.value.trim();
    if (!userResult) {
        stepResult.focus();
        stepResult.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        setTimeout(() => { stepResult.style.borderColor = ''; }, 1500);
        return;
    }

    submitStepBtn.disabled = true;
    submitStepBtn.querySelector('span').textContent = 'Evaluating...';

    const stepText = steps[currentStepIndex].title || steps[currentStepIndex];

    try {
        const resp = await fetch('/api/evaluate-step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task: currentTask,
                step: stepText,
                user_result: userResult
            })
        });
        const data = await resp.json();

        if (!resp.ok) throw new Error(data.error || 'Evaluation failed.');

        // Save to Supabase
        await saveSubmissionToSupabase(currentStepIndex, userResult, data.raw_feedback || '', data.is_correct);

        // Track mistakes
        if (!data.is_correct) {
            stepsStatus[currentStepIndex] = 'retry';
            mistakeLog.push({
                step: currentStepIndex + 1,
                stepTitle: stepText,
                feedback: data.raw_feedback || data.feedback
            });
            updateMistakeLog();
        }

        showFeedback(data.feedback, data.is_correct);
        renderSidebarSteps();

    } catch (err) {
        showError(err.message);
        submitStepBtn.disabled = false;
        submitStepBtn.querySelector('span').textContent = 'Submit Step';
    }
}

// --- SHOW FEEDBACK ---
function showFeedback(html, isCorrect) {
    feedbackCard.style.display = 'block';
    feedbackCard.className = 'feedback-card glass-card ' + (isCorrect ? 'success' : 'failure');
    feedbackCard.style.animation = 'none';
    feedbackCard.offsetHeight;
    feedbackCard.style.animation = 'fadeInUp 0.4s ease both';

    feedbackContent.innerHTML = html;

    if (isCorrect) {
        statusIcon.textContent = '✅';
        statusText.textContent = 'Step Accepted!';
        feedbackActions.innerHTML = '';

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

    feedbackCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- NAVIGATION ---
function goToNextStep() {
    stepsStatus[currentStepIndex] = 'completed';
    completedSteps++;
    currentStepIndex++;
    updateProgress();
    renderSidebarSteps();
    renderCurrentStep();
}

function retryStep() {
    feedbackCard.style.display = 'none';
    stepResult.value = '';
    stepResult.focus();
    submitStepBtn.disabled = false;
    submitStepBtn.querySelector('span').textContent = 'Submit Step';
    document.getElementById('stepExecCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- MISTAKE LOG ---
function updateMistakeLog() {
    mistakeCount.textContent = `(${mistakeLog.length})`;

    if (mistakeLog.length === 0) {
        mistakeList.innerHTML = '<p class="empty-state">No mistakes logged yet.</p>';
        return;
    }

    mistakeList.innerHTML = '';
    mistakeLog.forEach(m => {
        const item = document.createElement('div');
        item.className = 'mistake-item';
        item.innerHTML = `
            <div class="mistake-step">Step ${m.step}: ${m.stepTitle}</div>
            <div>${typeof m.feedback === 'string' ? m.feedback.substring(0, 200) : ''}${m.feedback && m.feedback.length > 200 ? '...' : ''}</div>
        `;
        mistakeList.appendChild(item);
    });
}

// --- FINAL REVIEW ---
async function moveToFinalReview() {
    stepsStatus[currentStepIndex] = 'completed';
    completedSteps = steps.length;
    updateProgress();
    renderSidebarSteps();

    showPhase('final');
    finalCard.style.display = 'none';

    try {
        const stepsText = steps.map((s, i) => `${i + 1}. ${s.title || s}`).join('\n');
        const mistakesText = mistakeLog.length > 0
            ? '\n\nMistakes made:\n' + mistakeLog.map(m => `- Step ${m.step}: ${m.feedback ? m.feedback.substring(0, 150) : 'Error'}`).join('\n')
            : '';

        const resp = await fetch('/api/final-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task: currentTask,
                steps: stepsText + mistakesText
            })
        });
        const data = await resp.json();

        if (!resp.ok) throw new Error(data.error || 'Review failed.');

        document.querySelector('.final-header p').textContent = "Here is your mentor's final assessment.";
        finalContent.innerHTML = data.review;
        finalCard.style.display = 'block';

    } catch (err) {
        showError(err.message);
    }
}

// --- START NEW TASK ---
function startNewTask() {
    currentTask = '';
    steps = [];
    stepDbIds = [];
    currentStepIndex = 0;
    completedSteps = 0;
    stepsStatus = [];
    mistakeLog = [];
    currentTaskId = null;
    taskInput.value = '';
    taskInput.dispatchEvent(new Event('input'));
    updateMistakeLog();

    // Reset sidebar
    sidebarSteps.innerHTML = '<p class="empty-state">No steps yet. Enter a task to begin.</p>';
    progressPercentage.textContent = '0%';
    progressFill.style.width = '0%';
    progressCount.textContent = '0 / 0 steps';

    showPhase('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- ERROR ---
function showError(msg) {
    errorMessage.textContent = msg;
    errorSection.style.display = 'block';
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
    errorSection.style.display = 'none';
}

// --- KEYBOARD SHORTCUTS ---
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startTask();
    }
});

// --- TOAST ---
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
