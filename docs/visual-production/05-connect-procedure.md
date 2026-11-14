# 5. Exact procedure to connect Higgsfield (ChatGPT or Claude, browser sign-in)

**Nothing in this procedure has been performed.** Every step marked 🛑 is a point where the assistant must stop and wait
for the owner's written go. The assistant never enters card details, never accepts an offer, never cancels or
upgrades; the owner does these in their own browser.

Source for the steps: Higgsfield's [connect-an-agent help article](https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent)
(1 Aug 2026), the [Unlimited MCP post](https://higgsfield.ai/blog/unlimited-mcp) (28 Jul 2026, for the trial-activation
mechanics) and the [11.11 post](https://higgsfield.ai/blog/higgsfield-11-11-deals) (11 Nov 2026, current offer). Screens
change: if a label differs, trust the screen and tell the assistant.

## 5.0 Before starting

* Decide the client: **Claude** (claude.ai or Claude Desktop) *or* **ChatGPT**. Both do image and video; ChatGPT has no
  audio (not needed).
* Have ready: a Higgsfield account (sign-in in the browser), a payment card in case the offer requires one, the
  blueprint files `side.png`, `front.png`, `rear.png` from `assets-src/sedan-ref/references/` downloaded to the
  computer (GitHub → file → Download raw), and the five prompt files in `docs/visual-production/prompts-ae01/`.
* Check **Gate G1 part 1** first (`01-integration-assessment.md` §1.3): read the offer page — price after trial,
  renewal date/time, start condition, cancellation, eligibility — and complete `trial-verification.md`.
  **Do not enter a card to "see the price".**

## 5.1 Connecting — Claude (claude.ai or Claude Desktop)

1. Sign in to Higgsfield in the same browser (higgsfield.ai) so that the later authorisation is automatic.
2. In Claude: **Settings → Connectors → Add custom connector** (the July post words it *Customize → Connectors*).
3. Name: `Higgsfield`. URL: `https://mcp.higgsfield.ai/mcp`. Click **Connect**.
4. A Higgsfield authorisation window opens: sign in and **authorise** the connector. Return to Claude; Higgsfield appears
   in the active connectors.
5. 🛑 Connecting the connector is **separate** from starting the trial (July post: "having the connector installed
   doesn't automatically start the trial"). If an offer screen appears with a button to start the trial, **stop and
   tell the assistant what it says** — the owner decides (Gate G2).

## 5.2 Connecting — ChatGPT

1. Open the Plugins Directory in ChatGPT, or go to higgsfield.ai/mcp and choose **Add Higgsfield plugin**.
2. Find **Higgsfield** → **Add** → sign in to Higgsfield and authorise.
3. 🛑 Same rule as 5.1 step 5.
4. Reconnection later: Settings → Plugins → Higgsfield.

## 5.3 Verification in the connected chat (zero credits, read-only) — Gate G1 part 2

Paste these **one at a time** into a new conversation in the connected chat. The first three create no media and cost
nothing. Record each answer (copy the text) in `trial-verification.md`.

1. `List the Higgsfield tools you can use in this conversation. Do not generate anything.`
   *Pass:* the assistant names Higgsfield tools. If it answers without calling any tool, reconnect (5.1/5.2).
2. `What is my current Higgsfield credit balance, and what plan or trial am I on? State the plan name, whether any
   Unlimited access is active, the end date and time of the trial or benefit, and the renewal date and price. Do not
   generate anything.`
   *Pass to continue:* a trial/benefit with **Unlimited** active, an end ≈ 72 h after activation, **renewal on Ultra 3K**,
   a renewal date and a price. *If the connector cannot say, read it on higgsfield.ai → Manage Account → Subscription
   and paste it here.* **If no Unlimited benefit is shown for this account/connection → STOP (regime B: credits).**
3. `Before generating anything, tell me the credit cost of (a) one 2K image and (b) one 8-second video, for each
   image/video model you can use, and say which of them are inside my Unlimited access without deducting credits, with
   their resolution, duration and concurrency limits. Wait for my confirmation.`
   *Pass:* the models we need show **0 credits / Unlimited**. *If credits are quoted → STOP and ask the owner.*
4. 🛑 Owner writes: `Approved: phase 1 only (AE-01 Meridian, 16 generations maximum), scenario B (unlimited), no
   upscaling.` — or scenario A with a credit ceiling. Only then continue to 5.4.

Standing instruction to paste at the start of every session: `Before generating anything, tell me the credit cost and
wait for my confirmation. Never upscale, outpaint, generate audio or start a video unless I say so. Generate one item at
a time.`

## 5.4 Running phase 1 (after Gate G2 and 5.3)

For each file in `prompts-ae01/` in order 1 → 5:

1. Tell the assistant which references you will upload (the file lists them) and ask it to **open the Higgsfield upload
   window**: `Open the Higgsfield upload window for my file.` (The assistant cannot read images attached to the chat.)
2. Upload the listed reference(s); ask the assistant to confirm each upload before generating.
3. Paste the prompt exactly; state the **model** (the one chosen in 5.3.3 for all five views), the aspect ratio and that
   it must be **one image**. Add the negative list.
4. When the result appears, **do not accept it blindly**: run the checklist (`prompts-ae01/README.md`), and for `side`
   the overlay check. Record the **job id** and the **model/version** shown.
5. If it fails, change only what the failure points to, stay within the attempt cap, and tell the assistant. After the cap,
   stop and report.
6. Download approved candidates from higgsfield.ai → Assets (filter by MCP source), full resolution, keep the file
   names with the prompt id, e.g. `P-AE01-front34_<job id>.png`.

## 5.5 Handing the files back

Pick one:

* **A. Attach them to this repository conversation** with the job id, model and date for each (the assistant runs
  `tools/concept/ingest.py add`, writes the manifest, commits to `visual-production-prep`).
* **B. Upload via GitHub** (web UI → *Add file → Upload files*) to branch `visual-production-prep`, folder
  `assets-src/concepts/_inbox/`, together with a text file listing job id, model, date, surface and prompt id per image;
  the assistant ingests and removes the inbox files.

Videos (phase 4, **not now**) are never uploaded to the repository: Google Drive
`Automotive Empire/Visuales/Videos`, see 04 §4.1.

## 5.6 After the run — the owner's account actions (assistant only reminds)

* Note the subscription status and renewal date on higgsfield.ai → Manage Account → Subscription; set a reminder
  24 h before the renewal.
* To avoid the renewal charge the owner cancels auto-renewal there (or by chat message, as described for the July trial)
  **before the trial ends**. Whether cancelling early keeps access to the end of the window must have been read in
  G1 part 1.
* Disconnect (optional): Claude → Settings → Connectors → Higgsfield → Disconnect; ChatGPT → Settings → Plugins → Higgsfield.

## 5.7 Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| "Authorization with the MCP server failed" | token expired: disconnect, reconnect, re-authorise (5.1/5.2) |
| Assistant answers without using tools | connector not active in this chat; reconnect |
| Prices or an upgrade prompt appear when generating | the request is outside the benefit (model, resolution, duration), more than one job running, or the account is in regime B → stop, report to the owner |
| Upload window does not appear | ask: "Open the Higgsfield upload window for my file." |
| Result not in Assets yet | wait up to a minute; filter Assets by MCP source |
| Card declined | try another card; the assistant does not handle payment |

## 5.8 Local alternative (not the plan, documented for completeness)

If a local Claude Code install exists later: `npm i -g @higgsfield/cli`, `higgsfield auth login` (browser),
`npx skills add higgsfield-ai/skills`. Same gates and same cost rules apply.
