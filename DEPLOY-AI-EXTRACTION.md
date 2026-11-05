# Deploy AI Levy Extraction — Step by Step

## What this sets up
A Supabase Edge Function that receives a PDF, sends it to Claude AI,
and returns structured line items (electricity, water, levy, etc.)

---

## Step 1 — Get your Anthropic API key

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Go to **API Keys** in the left sidebar
4. Click **Create Key** → name it "PropMaster"
5. Copy the key — it starts with `sk-ant-...`
   ⚠️ You only see it once — paste it somewhere safe immediately

---

## Step 2 — Install Supabase CLI

If you don't have it yet:

```bash
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or via npm (any platform)
npm install -g supabase
```

Verify it works:
```bash
supabase --version
```

---

## Step 3 — Log in to Supabase CLI

```bash
supabase login
```
This opens a browser — approve access.

---

## Step 4 — Link your project

From inside the propmaster folder:
```bash
supabase link --project-ref cghiodbvbggizghxuvna
```

When prompted for your database password, find it in:
Supabase Dashboard → Settings → Database → Database password

---

## Step 5 — Set your Anthropic API key as a secret

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

This stores it securely in Supabase Vault — it never touches your code.

Verify it was saved:
```bash
supabase secrets list
```

---

## Step 6 — Deploy the Edge Function

```bash
supabase functions deploy extract-statement
```

You should see:
```
Deploying function extract-statement...
Done: extract-statement
```

---

## Step 7 — Test it

Go to your app → any property → Running Costs tab → upload a real COJ or levy PDF.

The upload card now says "AI powered" and will:
1. Show a spinner while Claude reads the document
2. Show a review modal with every extracted line item
3. Let you toggle each item as recoverable or non-recoverable
4. Add selected items to the month's running costs

---

## Troubleshooting

**"ANTHROPIC_API_KEY is not configured"**
→ Re-run Step 5, then re-deploy (Step 6)

**"Extraction failed. Please try again or add the items manually."**
→ Check Supabase Edge Function logs:
```bash
supabase functions logs extract-statement
```

**"No line items could be found"**
→ The PDF may be a scanned image rather than a text PDF.
   Try a different statement or add items manually.

**Function deploys but returns 401**
→ Make sure you're logged in to the app — the function checks your Supabase session.

---

## Model & cost

The function uses `claude-opus-5-5` at low effort with structured JSON
output, so responses always match the expected shape. A 1–4 page statement
is typically a few thousand input tokens — well under R1 per statement.
Check current pricing at https://www.anthropic.com/pricing.
