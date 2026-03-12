from flask import Flask, render_template, request, jsonify
from groq import Groq
from dotenv import load_dotenv
import markdown
import json
import re
import os

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)

# ---------------------------------
# API CLIENT
# ---------------------------------

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


# ---------------------------------
# LLM CALL
# ---------------------------------

def ask_llm(prompt):
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return response.choices[0].message.content


# ---------------------------------
# STEP GENERATOR (structured)
# ---------------------------------

def generate_steps(task):
    prompt = f"""
Break this task into clear numbered steps. Each step must have a title, explanation, and a list of detailed sub-steps.

Task: {task}

Return ONLY a valid JSON array. Each element must have "title", "explanation", and "substeps" (an array of strings).
Each step should have 3-5 detailed sub-steps that break it down into small, actionable items.

Example:
[
  {{
    "title": "Install Python",
    "explanation": "Download and install Python on your system to start programming.",
    "substeps": [
      "Go to python.org/downloads in your browser",
      "Click the latest stable version download button",
      "Run the installer and check 'Add Python to PATH'",
      "Click Install Now and wait for completion"
    ]
  }},
  {{
    "title": "Verify Installation",
    "explanation": "Confirm Python is properly installed and accessible from terminal.",
    "substeps": [
      "Open Command Prompt or Terminal",
      "Type python --version and press Enter",
      "Verify it shows the version number you installed",
      "Type pip --version to confirm pip is also available"
    ]
  }}
]

Return ONLY the JSON array, no extra text.
"""
    result = ask_llm(prompt)

    # Try to parse JSON from the response
    try:
        # Clean markdown code fences if present
        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
            cleaned = re.sub(r'\s*```$', '', cleaned)
        steps = json.loads(cleaned)
        if isinstance(steps, list) and len(steps) > 0:
            return steps
    except (json.JSONDecodeError, ValueError):
        pass

    # Fallback: parse numbered list
    lines = result.split("\n")
    steps = []
    for line in lines:
        line = line.strip()
        if line and re.match(r'^\d+[\.\)]\s', line):
            title = re.sub(r'^\d+[\.\)]\s*', '', line).strip()
            steps.append({"title": title, "explanation": "", "substeps": []})

    if not steps:
        # Last resort: each non-empty line is a step
        steps = [{"title": l.strip(), "explanation": "", "substeps": []} for l in lines if l.strip()]

    return steps


# ---------------------------------
# STEP EVALUATION
# ---------------------------------

def evaluate_step(task, step, user_result):
    prompt = f"""
You are a ruthless task supervisor.

Task:
{task}

Current Step:
{step}

User Result:
{user_result}

Rules:
- Do not sugarcoat.
- If wrong explain the mistake clearly.
- Tell the user what to fix.
- If correct say "CORRECT".
"""
    return ask_llm(prompt)


# ---------------------------------
# FINAL REVIEW
# ---------------------------------

def final_review(task, steps):
    prompt = f"""
Task:
{task}

Steps completed:
{steps}

Give a strict final review.

Mention:
- What was done well
- Mistakes made
- Improvements
"""
    return ask_llm(prompt)


# ---------------------------------
# ROUTES
# ---------------------------------

@app.route("/")
def index():
    return render_template("login.html", env=get_supabase_env())


@app.route("/login")
def login():
    return render_template("login.html", env=get_supabase_env())


@app.route("/signup")
def signup():
    return render_template("signup.html", env=get_supabase_env())


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", env=get_supabase_env())

def get_supabase_env():
    return {
        "SUPABASE_URL": os.getenv("SUPABASE_URL", ""),
        "SUPABASE_ANON_KEY": os.getenv("SUPABASE_ANON_KEY", "")
    }


@app.route("/api/generate-steps", methods=["POST"])
def api_generate_steps():
    data = request.get_json()
    task = data.get("task", "").strip()

    if not task:
        return jsonify({"error": "Please enter a task."}), 400

    try:
        steps = generate_steps(task)
        return jsonify({"steps": steps, "total": len(steps)})
    except Exception as e:
        return jsonify({"error": f"Failed to generate steps: {str(e)}"}), 500


@app.route("/api/evaluate-step", methods=["POST"])
def api_evaluate_step():
    data = request.get_json()
    task = data.get("task", "").strip()
    step = data.get("step", "").strip()
    user_result = data.get("user_result", "").strip()

    if not all([task, step, user_result]):
        return jsonify({"error": "Missing required fields."}), 400

    try:
        feedback = evaluate_step(task, step, user_result)
        is_correct = "correct" in feedback.lower()
        feedback_html = markdown.markdown(feedback, extensions=["fenced_code", "tables", "nl2br"])
        return jsonify({
            "feedback": feedback_html,
            "raw_feedback": feedback,
            "is_correct": is_correct
        })
    except Exception as e:
        return jsonify({"error": f"Evaluation failed: {str(e)}"}), 500


@app.route("/api/final-review", methods=["POST"])
def api_final_review():
    data = request.get_json()
    task = data.get("task", "").strip()
    steps = data.get("steps", "").strip()

    if not all([task, steps]):
        return jsonify({"error": "Missing required fields."}), 400

    try:
        review = final_review(task, steps)
        review_html = markdown.markdown(review, extensions=["fenced_code", "tables", "nl2br"])
        return jsonify({"review": review_html, "raw_review": review})
    except Exception as e:
        return jsonify({"error": f"Review failed: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)