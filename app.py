from flask import Flask, render_template, request, jsonify, session
from groq import Groq
from dotenv import load_dotenv
import markdown
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
# STEP GENERATOR
# ---------------------------------

def generate_steps(task):
    prompt = f"""
Break this task into clear numbered steps.

Task: {task}

Return only numbered steps.
Example:

1. Step
2. Step
3. Step
"""
    result = ask_llm(prompt)
    steps = result.split("\n")
    steps = [s.strip() for s in steps if s.strip() != ""]
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
    return render_template("index.html")


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