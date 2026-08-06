from youtube_transcript_api import YouTubeTranscriptApi
import google.generativeai as genai
import os
import json
import time
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")
genai.configure(api_key=os.getenv("VITE_GEMINI_API_KEY"))

# Yahan apne saare video IDs daalo
VIDEO_IDS = [
    "lKpp2UT8rlc",
    "MrQ5dvvNuVs",
    "wLE1BT_wDo4",
    "nn-1UU_1PX8",
]

def get_transcript(video_id):
    ytt_api = YouTubeTranscriptApi()
    transcript = ytt_api.fetch(video_id, languages=['hi', 'en'])
    return " ".join([snippet.text for snippet in transcript])

def analyze_teacher_style(transcript_text):
    model = genai.GenerativeModel("gemini-flash-latest")
    prompt = f"""
Is transcript ko analyze karke teacher ka teaching-style profile do, in dimensions par 1-10 scale mein score karo:

1. pace (1=very slow/detailed, 10=fast/dense)
2. theory_vs_practical (1=pure theory, 10=pure hands-on/examples)
3. structure (1=freeform/tangential, 10=highly structured/stepwise)
4. depth (1=surface overview, 10=deep technical rigor)
5. language_complexity (1=simple everyday words, 10=jargon-heavy)
6. storytelling (1=dry facts, 10=analogy/story-driven)
7. repetition (1=says once, 10=repeats/reinforces concepts often)
8. prerequisite_assumed (1=zero background needed, 10=assumes strong prior knowledge)

Ye bhi do:
- primary_style: [visual/verbal/example-driven/socratic/lecture]
- ideal_for: kis tarah ke learner ke liye best fit hai (2-3 lines)
- avoid_for: kis tarah ke learner ko struggle ho sakti hai

Sirf JSON return karo, koi extra text nahi, koi markdown backticks nahi.

Transcript:
{transcript_text[:8000]}
"""
    response = model.generate_content(prompt)
    text = response.text.strip()
    # Kabhi-kabhi Gemini ```json wrap kar deta hai, usko clean karte hain
    text = text.replace("```json", "").replace("```", "").strip()
    return text
def main():
    all_results = {}

    for video_id in VIDEO_IDS:
        print(f"\n{'='*50}")
        print(f"Processing: {video_id}")
        print('='*50)

        try:
            print("Fetching transcript...")
            transcript_text = get_transcript(video_id)
            print(f"Transcript fetched: {len(transcript_text)} characters")

            print("Analyzing with Gemini...")
            result_text = analyze_teacher_style(transcript_text)

            try:
                result_json = json.loads(result_text)
                all_results[video_id] = result_json
                print("✅ Success")
            except json.JSONDecodeError:
                print("⚠️ Gemini ka response valid JSON nahi tha, raw text save kar rahe hain")
                all_results[video_id] = {"raw_response": result_text}

        except Exception as e:
            print(f"❌ Error: {e}")
            all_results[video_id] = {"error": str(e)}

        # Thoda rukte hain taaki API rate-limit na ho
        time.sleep(2)

    # Sab results ek JSON file mein save karo
    output_file = "teacher_profiles.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print(f"\n\n{'='*50}")
    print(f"Sab results save ho gaye: {output_file}")
    print('='*50)

if __name__ == "__main__":
    main()