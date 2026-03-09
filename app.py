from flask import Flask, render_template, request, jsonify
from groq import Groq
from dotenv import load_dotenv
import markdown
import os

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)

# Load API key from environment
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def autonomous_agent(task):
    prompt = f"""
You are an intelligent autonomous AI assistant.

For the given task, do the following:

1. Break the task into clear step-by-step actions.
2. Explain HOW the user should perform each step.
3. Suggest useful tools, websites, or resources.
4. Give tips to get the BEST result while doing the task.
5. Mention common mistakes to avoid.
6. End with a short summary of the best strategy.

Task: {task}
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json()
    task = data.get("task", "").strip()

    if not task:
        return jsonify({"error": "Please enter a task."}), 400

    try:
        result = autonomous_agent(task)
        # Convert markdown to HTML for rich rendering
        html_result = markdown.markdown(result, extensions=["fenced_code", "tables", "nl2br"])
        return jsonify({"result": html_result, "raw": result})
    except Exception as e:
        return jsonify({"error": f"Something went wrong: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)