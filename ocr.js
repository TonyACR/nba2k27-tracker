export async function onRequestPost(context) {
    try {
        const { request, env } = context;

        if (!env.GEMINI_API_KEY) {
            return jsonResponse(
                {
                    error: "GEMINI_API_KEY non configurata su Cloudflare."
                },
                500
            );
        }

        const body = await request.json();

        if (!body.image) {
            return jsonResponse(
                {
                    error: "Immagine mancante."
                },
                400
            );
        }

        const image = body.image;

        const match = image.match(
            /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/
        );

        if (!match) {
            return jsonResponse(
                {
                    error: "Formato immagine non valido."
                },
                400
            );
        }

        const mimeType =
            match[1] === "image/jpg"
                ? "image/jpeg"
                : match[1];

        const base64Data = match[2];

        const prompt = `
You are an expert OCR system specialized in NBA 2K GAME STATS screenshots.

Analyze the provided NBA 2K GAME STATS screenshot extremely carefully.

Extract ONLY information that is actually visible.

The screenshot contains two teams:
- Away Team
- Home Team

Normally each team contains 5 players.

For every player extract:

- name
- grade
- pts
- reb
- ast
- stl
- blk
- fouls
- to
- fgm
- fga
- three_pm
- three_pa
- ftm
- fta

Also extract the final score for both teams.

IMPORTANT RULES:

1. NEVER invent a value.
2. NEVER guess a player's name.
3. NEVER infer a statistic that is not visible.
4. If something cannot be read with confidence, return null.
5. Carefully distinguish numbers such as 0, 6, 8, 3, 5 and 9.
6. Carefully distinguish "/" in shooting statistics.
7. Preserve player names as they appear in the screenshot.
8. Return exactly the players visible in the screenshot.
9. Do not add commentary.
10. Return ONLY valid JSON.

Use this exact structure:

{
  "game_type": "NBA 2K GAME STATS",
  "away_team": {
    "name": "Away Team",
    "score": null,
    "players": [
      {
        "name": null,
        "grade": null,
        "pts": null,
        "reb": null,
        "ast": null,
        "stl": null,
        "blk": null,
        "fouls": null,
        "to": null,
        "fgm": null,
        "fga": null,
        "three_pm": null,
        "three_pa": null,
        "ftm": null,
        "fta": null
      }
    ]
  },
  "home_team": {
    "name": "Home Team",
    "score": null,
    "players": [
      {
        "name": null,
        "grade": null,
        "pts": null,
        "reb": null,
        "ast": null,
        "stl": null,
        "blk": null,
        "fouls": null,
        "to": null,
        "fgm": null,
        "fga": null,
        "three_pm": null,
        "three_pa": null,
        "ftm": null,
        "fta": null
      }
    ]
  }
}

Return JSON only.
`;

        const geminiResponse = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
                encodeURIComponent(env.GEMINI_API_KEY),
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64Data
                                    }
                                }
                            ]
                        }
                    ],

                    generationConfig: {
                        temperature: 0,
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        const geminiData =
            await geminiResponse.json();

        if (!geminiResponse.ok) {
            console.error(
                "Gemini error:",
                geminiData
            );

            return jsonResponse(
                {
                    error:
                        geminiData?.error?.message ||
                        "Errore Gemini API."
                },
                geminiResponse.status
            );
        }

        const text =
            geminiData?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

        if (!text) {
            return jsonResponse(
                {
                    error: "Gemini non ha restituito alcun risultato."
                },
                500
            );
        }

        let result;

        try {
            result = JSON.parse(text);
        } catch (error) {
            console.error(
                "JSON Gemini non valido:",
                text
            );

            return jsonResponse(
                {
                    error: "Gemini ha restituito JSON non valido.",
                    raw: text
                },
                500
            );
        }

        return jsonResponse({
            success: true,
            data: result
        });

    } catch (error) {
        console.error(error);

        return jsonResponse(
            {
                error:
                    error?.message ||
                    "Errore interno del server."
            },
            500
        );
    }
}


function jsonResponse(data, status = 200) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type": "application/json; charset=UTF-8",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        }
    );
}


export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}