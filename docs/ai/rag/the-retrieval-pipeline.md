---
sidebar_position: 1
title: The retrieval pipeline
sidebar_label: "RAG: The retrieval pipeline"
hide_table_of_contents: true
---

# The retrieval pipeline

<Updated date="2026-11-19" />

<Topics tags={['RAG', 'Parametric vs source knowledge', 'Chunking', 'Recursive splitting', 'Semantic splitting', 'Bi-encoders', 'Cosine similarity', 'ANN indexes', 'HNSW / IVF', 'Product quantization']} />

Ask a company chatbot "what's our refund policy for annual plans?" and it hits a wall: the answer lives in a document the model has never read. A large language model (LLM) answers from what training froze into it, so it does one of two things — admits it doesn't know, or invents something fluent, confident and wrong. That second failure is a **hallucination**, and it is the expensive one, because nothing in the answer looks wrong.

**Retrieval-Augmented Generation (RAG)** is the standard fix, and the idea is almost insultingly simple: look the answer up first, then ask the model to write it up. The engineering is all in the "look it up" part. This lesson builds that machinery — the end-to-end pipeline first, then the three components inside it that do the actual work.

## Two kinds of knowledge

An LLM can draw on exactly two sources of knowledge, and the distinction is the whole premise of RAG.

**Parametric knowledge** is baked into the model's weights during training and frozen there.<Sidenote>"Parametric" because the knowledge lives in the model's parameters — the numbers adjusted during training.</Sidenote> It is broad, it is free at inference time, and it cannot be updated without retraining.

**Source knowledge** is whatever text you place in the prompt at question time. It costs tokens, it is bounded by the model's **context window** (the maximum amount of text the model can read in one request), and it is completely under your control.

Anything that wasn't in the training data — proprietary documents, a live code repository, one customer's order history, yesterday's policy change — can only ever reach the model as source knowledge. There is no third option.

## RAG: making it an open-book exam

RAG is an architectural pattern, not a model change. You don't fine-tune and you don't retrain. You treat the LLM as a **stateless compute engine** — it remembers nothing between requests, so every request must carry everything it needs — and at question time the system:

1. searches a store of your own documents and pulls out the few short passages (**chunks**) most likely to contain the answer,
2. pastes those passages into the prompt, with an instruction to answer from them rather than from memory.

A closed-book exam becomes an open-book one. The model no longer has to *recall* the answer; it only has to read the page you handed it and write a reply. That shift is why RAG suppresses hallucination: the facts are in front of the model, not dredged out of its weights.

## The naive pipeline: two paths, one database {#the-pipeline}

The baseline version — usually called **naive RAG** — is a straight line: no branching, no retries, no second opinions. What makes it two things rather than one is *when* each half runs.

### The ingestion path — offline, the write path

This runs ahead of time, once per version of a document, with nobody waiting on it. Take the employee handbook as an example:

1. **Load and parse.** Pull the text out of whatever the file actually is — a PDF, a Markdown page in a repository, a row in a CMS. What survives is a long string, plus whatever metadata you choose to keep with it: source file, page number, section heading. That metadata travels with the chunk into the database and is what later lets an answer say where it came from.
2. **Split.** Cut that string into **chunks** of a few hundred tokens each<Sidenote>A **token** is a unit of text from the model's vocabulary — roughly a short word or a word fragment. English prose averages about four characters per token.</Sidenote> — small enough that one chunk is about one thing, large enough that it still makes sense read on its own. The handbook's annual-plan refund rules become their own chunk, separate from the rules on parental leave.
3. **Embed.** Send every chunk through an **embedding model**, which returns a **vector**: a fixed-length list of numbers that encodes what the chunk means. Similar meanings produce nearby vectors.
4. **Store.** Write each vector into a **vector database**, together with the chunk's original text and where it came from. The vector is the search key; the text is what you will eventually hand the LLM.

<details>
<summary>(Optional) What step 1 throws away — and what happens to images</summary>

Parsing is lossy, and the losses are not all equal. Styling is no loss at all. Layout often is: a table flattened into a run of words can stop meaning anything, which is why better parsers re-emit structure as Markdown rather than plain text.

Anything with no text in it — a diagram, a photo, a scanned page — yields nothing to extract, and a text-only pipeline simply drops those. A pipeline that needs them has two options: describe each image with a vision model and index the description as if it were text, or use a **multimodal** embedding model that places images and text in one shared vector space, so a question can match a picture directly.

</details>

Notice that not one step above depends on any particular question, which is why the whole path can be slow, batched and scheduled nightly. This is precomputation in exactly the sense a database index is: do the expensive work once, off the request path, so the request itself is cheap.

### The inference path — online, the read path

This runs once per question, inside the few seconds a user will tolerate, and it can only use what ingestion has already stored:

1. **Embed the question.** The same embedding model turns "what's our refund policy for annual plans?" into a vector, in the same space as the chunks.
2. **Search.** The database finds the stored vectors nearest to the question's vector and returns the top *k* — typically three to five — along with their original text. This is the only step that actually decides whether the system can answer at all.
3. **Build the prompt.** Paste those chunks into a template, alongside the question and an instruction like *"answer using only the context above; if it isn't there, say so."*
4. **Generate.** The LLM reads the assembled prompt and writes the answer.

End to end: the handbook was chunked and embedded last night; this morning the question is embedded, lands near the chunk about annual-plan refunds, and that chunk is pasted into a prompt. The model never "knew" the policy — it read it, half a second ago.

<figure className="diagram" id="pipeline-diagram">
<svg viewBox="0 0 700 258" width="700" height="258" role="img" aria-label="The naive RAG pipeline, with its three reusable components numbered one, two and three. The offline ingestion path runs along the top: documents are parsed and chunked by component one, the splitter, then embedded by component two, the embedding model, and the resulting vectors are written down into component three, the vector database. The online inference path runs along the bottom: the question is embedded by that same component two, a similarity search against component three retrieves the matching chunks, those chunks are placed into a prompt, the LLM reads it, and an answer comes out.">
  <defs>
    <marker id="rag-pipe-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <text className="d-label" x="12" y="20" fontSize="12" textAnchor="start">Ingestion — offline (write path)</text>
  <rect className="d-fill" x="12" y="36" width="110" height="44" rx="6" />
  <rect className="d-stroke" x="12" y="36" width="110" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="67" y="56" fontSize="11.5" textAnchor="middle">Documents</text>
  <text className="d-text" x="67" y="70" fontSize="11.5" textAnchor="middle">(PDF, MD, JSON)</text>
  <rect className="d-fill" x="150" y="36" width="110" height="44" rx="6" />
  <rect className="d-stroke" x="150" y="36" width="110" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="205" y="56" fontSize="11.5" textAnchor="middle">Parse and</text>
  <text className="d-text" x="205" y="70" fontSize="11.5" textAnchor="middle">chunk</text>
  <rect className="d-fill" x="288" y="36" width="116" height="44" rx="6" />
  <rect className="d-stroke" x="288" y="36" width="116" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="346" y="56" fontSize="11.5" textAnchor="middle">Embed</text>
  <text className="d-text" x="346" y="70" fontSize="11.5" textAnchor="middle">(bi-encoder)</text>
  <line className="d-accent-stroke" x1="122" y1="58" x2="146" y2="58" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <line className="d-accent-stroke" x1="260" y1="58" x2="284" y2="58" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <rect className="d-fill" x="284" y="118" width="124" height="44" rx="6" />
  <rect className="d-stroke" x="284" y="118" width="124" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="346" y="145" fontSize="11.5" textAnchor="middle">Vector database</text>
  <line className="d-accent-stroke" x1="346" y1="80" x2="346" y2="114" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <text className="d-label" x="12" y="186" fontSize="12" textAnchor="start">Inference — online (read path)</text>
  <rect className="d-fill" x="12" y="200" width="96" height="44" rx="6" />
  <rect className="d-stroke" x="12" y="200" width="96" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="60" y="227" fontSize="11.5" textAnchor="middle">Question</text>
  <rect className="d-fill" x="128" y="200" width="96" height="44" rx="6" />
  <rect className="d-stroke" x="128" y="200" width="96" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="176" y="220" fontSize="11.5" textAnchor="middle">Embed</text>
  <text className="d-text" x="176" y="234" fontSize="11.5" textAnchor="middle">(same model)</text>
  <rect className="d-fill" x="244" y="200" width="96" height="44" rx="6" />
  <rect className="d-stroke" x="244" y="200" width="96" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="292" y="220" fontSize="11.5" textAnchor="middle">Similarity</text>
  <text className="d-text" x="292" y="234" fontSize="11.5" textAnchor="middle">search</text>
  <rect className="d-fill" x="360" y="200" width="96" height="44" rx="6" />
  <rect className="d-stroke" x="360" y="200" width="96" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="408" y="220" fontSize="11.5" textAnchor="middle">Prompt with</text>
  <text className="d-text" x="408" y="234" fontSize="11.5" textAnchor="middle">chunks</text>
  <rect className="d-fill" x="476" y="200" width="96" height="44" rx="6" />
  <rect className="d-stroke" x="476" y="200" width="96" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="524" y="227" fontSize="11.5" textAnchor="middle">LLM</text>
  <rect className="d-fill" x="592" y="200" width="96" height="44" rx="6" />
  <rect className="d-stroke" x="592" y="200" width="96" height="44" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="640" y="227" fontSize="11.5" textAnchor="middle">Answer</text>
  <line className="d-accent-stroke" x1="108" y1="222" x2="124" y2="222" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <line className="d-accent-stroke" x1="224" y1="222" x2="240" y2="222" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <line className="d-accent-stroke" x1="340" y1="222" x2="356" y2="222" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <line className="d-accent-stroke" x1="456" y1="222" x2="472" y2="222" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <line className="d-accent-stroke" x1="572" y1="222" x2="588" y2="222" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <path className="d-accent-stroke" d="M346,162 V180 H292 V196" strokeWidth="1.5" markerEnd="url(#rag-pipe-arrow)" />
  <circle cx="150" cy="36" r="10" fill="var(--ifm-background-color)" />
  <circle className="d-accent-stroke" cx="150" cy="36" r="10" strokeWidth="1.5" />
  <text className="d-label" x="150" y="40" fontSize="11.5" fontWeight="600" textAnchor="middle">1</text>
  <circle cx="288" cy="36" r="10" fill="var(--ifm-background-color)" />
  <circle className="d-accent-stroke" cx="288" cy="36" r="10" strokeWidth="1.5" />
  <text className="d-label" x="288" y="40" fontSize="11.5" fontWeight="600" textAnchor="middle">2</text>
  <circle cx="284" cy="118" r="10" fill="var(--ifm-background-color)" />
  <circle className="d-accent-stroke" cx="284" cy="118" r="10" strokeWidth="1.5" />
  <text className="d-label" x="284" y="122" fontSize="11.5" fontWeight="600" textAnchor="middle">3</text>
  <circle cx="128" cy="200" r="10" fill="var(--ifm-background-color)" />
  <circle className="d-accent-stroke" cx="128" cy="200" r="10" strokeWidth="1.5" />
  <text className="d-label" x="128" y="204" fontSize="11.5" fontWeight="600" textAnchor="middle">2</text>
  <circle cx="244" cy="200" r="10" fill="var(--ifm-background-color)" />
  <circle className="d-accent-stroke" cx="244" cy="200" r="10" strokeWidth="1.5" />
  <text className="d-label" x="244" y="204" fontSize="11.5" fontWeight="600" textAnchor="middle">3</text>
</svg>
<figcaption>Two paths, one shared vector database. Ingestion fills it ahead of time; inference searches it per question. The numbered boxes — ① splitter, ② embedding model, ③ vector store — are the three components each section below opens up. Note that ② appears on both paths: it must be the same model.</figcaption>
</figure>

In pseudo-code, stripped to the structure:

```python
# Write path — runs offline, once per document version
def ingest(documents, embedder, store):
    for doc in documents:
        for chunk in split(doc.extract_text(), size=500, overlap=50):   # ①
            store.insert(                                               # ③
                vector=embedder.embed(chunk),                   # ② the search key
                payload={"text": chunk, "doc_id": doc.id},      # what the LLM reads
            )


# Read path — runs online, once per question
def answer(question, embedder, store, llm):
    query_vector = embedder.embed(question)                     # ② the same model
    matches = store.search_nearest(query_vector, top_k=3)                # ③
    context = "\n---\n".join(m.payload["text"] for m in matches)

    return llm.generate(f"""
Context:
---
{context}
---
Answer the question using only the context above. If the context does not
contain the answer, say so.
Question: {question}
""")
```

Two lines in there carry more weight than they look:

- **`embedder` is the same object on both paths.** Chunks and questions have to be turned into numbers by the same model, or the two sets of numbers mean different things and nearness between them is meaningless. That also makes the embedding model the hardest thing in the system to change: every stored vector came from the old one, so switching means re-embedding the entire corpus.
- **`payload` carries the original text, not just the vector.** The vector is only the search key — it can't be read back into words. The text stored beside it is what actually reaches the LLM.

That leaves three components doing the real work, and each one is a decision with consequences:

| | Component | What it decides |
| --- | --- | --- |
| ① | [The splitter](#chunking) | where documents get cut — and therefore what can be found at all |
| ② | [The embedding model](#embedding) | what "similar meaning" means, numerically |
| ③ | [The vector store](#vector-store) | how fast search is, and what it costs in RAM |

## ① Chunking: cutting documents into pieces {#chunking}

*Box ① in the [pipeline diagram](#pipeline-diagram) — "parse and chunk".*

Company knowledge doesn't arrive as neat paragraphs. It is trapped in PDFs with two-column layouts, Markdown repositories, nested JSON payloads — none of which map onto an LLM's input natively. **Text splitting** (chunking) is the step that turns one continuous string into separate, individually addressable blocks small enough to embed and to pass to a model.

Chunking decides what can be found later, so it deserves more thought than it usually gets. Four strategies, each answering a weakness in the one before.

### Character-based splitting

Cuts strictly on length. Set the threshold to 500 and the string is cut at exactly character 500, every time. It costs essentially nothing in CPU or memory, and that is its only virtue: it ignores punctuation, sentence ends and syntax entirely, so it routinely guillotines a word, a number or a clause down the middle.

### Recursive character splitting

The sensible default. It pairs a priority-ordered list of separators — paragraph breaks (`\n\n`), then line breaks (`\n`), then spaces, then bare characters — with two hard constraints:

- **Chunk limit** (`chunk_size`) — the most characters or tokens one chunk may hold, so the payload fits both the embedding model's input and the LLM's context window.
- **Chunk overlap** (`chunk_overlap`) — a lookback window that copies the tail of a finished chunk onto the front of the next one, so an idea that straddles a boundary survives in at least one chunk whole.

What makes it "recursive" is that it doesn't pick one separator for the whole document. It runs a local **split → check → merge or recurse** loop. Suppose the limit is 500 characters:

1. Split the text on the highest-priority separator, `\n\n`.
2. Walk the resulting paragraphs, merging them into the current chunk while the running total stays safely under 500.
3. When the next paragraph won't fit, close the chunk — then count backwards through what was just written to copy `chunk_overlap` worth of trailing text forward as the seed of the next chunk.
4. If a *single* paragraph exceeds 500 on its own, pause the merging loop for that paragraph only and drop to the next finer separator (`\n`, then spaces) to break it up, with overlaps. Once it is resolved, pop back up and carry on at paragraph level for the rest of the document.

So the fine-grained separators are an escape hatch for the awkward blocks, not a global setting.

<figure className="diagram">
<svg viewBox="0 0 700 262" width="700" height="262" role="img" aria-label="Recursive character splitting with a limit of 120 characters and an overlap of 30. Paragraph one of 70 characters and paragraph two of 40 characters fit together and merge into chunk one. Paragraph three is 170 characters, over the limit on its own, so the splitter drops to line breaks inside that paragraph and produces chunks two and three from its two lines of 85. It then returns to paragraph level, and paragraph four becomes chunk four. Every chunk after the first opens with 30 characters carried over from the chunk before it.">
  <defs>
    <marker id="rag-split-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <text className="d-label" x="85" y="18" fontSize="11.5" textAnchor="middle">the document</text>
  <text className="d-label" x="545" y="18" fontSize="11.5" textAnchor="middle">chunks produced</text>
  <rect className="d-fill" x="20" y="30" width="130" height="30" rx="5" />
  <rect className="d-stroke" x="20" y="30" width="130" height="30" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="85" y="49" fontSize="11" textAnchor="middle">¶1 · 70 chars</text>
  <rect className="d-fill" x="20" y="68" width="130" height="30" rx="5" />
  <rect className="d-stroke" x="20" y="68" width="130" height="30" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="85" y="87" fontSize="11" textAnchor="middle">¶2 · 40 chars</text>
  <rect className="d-fill" x="20" y="120" width="130" height="56" rx="5" />
  <rect className="d-stroke" x="20" y="120" width="130" height="56" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="85" y="143" fontSize="11" textAnchor="middle">¶3 · 170 chars</text>
  <text className="d-label" x="85" y="159" fontSize="10.5" textAnchor="middle">(two lines of 85)</text>
  <rect className="d-fill" x="20" y="216" width="130" height="30" rx="5" />
  <rect className="d-stroke" x="20" y="216" width="130" height="30" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="85" y="235" fontSize="11" textAnchor="middle">¶4 · 50 chars</text>
  <rect className="d-fill" x="470" y="30" width="150" height="34" rx="5" />
  <rect className="d-stroke" x="470" y="30" width="150" height="34" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="545" y="51" fontSize="11" textAnchor="middle">chunk 1 · 110</text>
  <rect className="d-fill" x="470" y="86" width="150" height="40" rx="5" />
  <rect className="d-stroke" x="470" y="86" width="150" height="40" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="545" y="102" fontSize="11" textAnchor="middle">chunk 2 · 85 new</text>
  <text className="d-label" x="545" y="117" fontSize="10.5" textAnchor="middle">+ 30 carried over</text>
  <rect className="d-fill" x="470" y="148" width="150" height="40" rx="5" />
  <rect className="d-stroke" x="470" y="148" width="150" height="40" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="545" y="164" fontSize="11" textAnchor="middle">chunk 3 · 85 new</text>
  <text className="d-label" x="545" y="179" fontSize="10.5" textAnchor="middle">+ 30 carried over</text>
  <rect className="d-fill" x="470" y="210" width="150" height="40" rx="5" />
  <rect className="d-stroke" x="470" y="210" width="150" height="40" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="545" y="226" fontSize="11" textAnchor="middle">chunk 4 · 50 new</text>
  <text className="d-label" x="545" y="241" fontSize="10.5" textAnchor="middle">+ 30 carried over</text>
  <line className="d-accent-stroke" x1="154" y1="45" x2="466" y2="42" strokeWidth="1.3" markerEnd="url(#rag-split-arrow)" />
  <line className="d-accent-stroke" x1="154" y1="83" x2="466" y2="54" strokeWidth="1.3" markerEnd="url(#rag-split-arrow)" />
  <line className="d-accent-stroke" x1="154" y1="138" x2="466" y2="100" strokeWidth="1.3" markerEnd="url(#rag-split-arrow)" />
  <line className="d-accent-stroke" x1="154" y1="158" x2="466" y2="162" strokeWidth="1.3" markerEnd="url(#rag-split-arrow)" />
  <line className="d-accent-stroke" x1="154" y1="231" x2="466" y2="228" strokeWidth="1.3" markerEnd="url(#rag-split-arrow)" />
  <line className="d-accent-stroke" x1="634" y1="64" x2="634" y2="80" strokeWidth="1.3" strokeDasharray="3 3" markerEnd="url(#rag-split-arrow)" />
  <line className="d-accent-stroke" x1="634" y1="126" x2="634" y2="142" strokeWidth="1.3" strokeDasharray="3 3" markerEnd="url(#rag-split-arrow)" />
  <line className="d-accent-stroke" x1="634" y1="188" x2="634" y2="204" strokeWidth="1.3" strokeDasharray="3 3" markerEnd="url(#rag-split-arrow)" />
  <text className="d-label" x="650" y="126" fontSize="10" textAnchor="start">overlap</text>
  <rect x="219.8" y="17" width="180.4" height="15" rx="3" fill="var(--ifm-background-color)" />
  <text className="d-label" x="310" y="28" fontSize="10.5" textAnchor="middle">70 + 40 ≤ 120 — merge them</text>
  <rect x="307" y="125" width="136" height="28" rx="3" fill="var(--ifm-background-color)" />
  <text className="d-label" x="375" y="136" fontSize="10.5" textAnchor="middle">¶3 alone: 170 > 120</text>
  <text className="d-label" x="375" y="148" fontSize="10.5" textAnchor="middle">drop to line breaks</text>
  <rect x="229.4" y="209" width="161.2" height="15" rx="3" fill="var(--ifm-background-color)" />
  <text className="d-label" x="310" y="220" fontSize="10.5" textAnchor="middle">back at paragraph level</text>
</svg>
<figcaption>One pass with <code>chunk_size</code> 120 and <code>chunk_overlap</code> 30. Paragraphs merge while they fit; ¶3 busts the limit on its own, so the splitter drops to a finer separator for that block only, then returns to paragraph level for ¶4. Every chunk after the first opens with the last 30 characters of the one before it — the dashed arrows — so an idea sitting on a boundary survives whole in at least one of them.</figcaption>
</figure>

### Specialized structural splitting

Uses the file's own grammar instead of generic separators — an abstract syntax tree for source code, strict markup rules for documentation. This matters because a recursive splitter will happily cut a loop body in half, or strand a Markdown table from the subheading that explains what it tabulates. A structural splitter targets the syntax explicitly, keeping an entire Python class declaration or a complete Markdown header block as one unbreakable unit, whatever its character count.

### Semantic splitting

Throws out syntax boundaries and cuts where the *meaning* turns. It parses the document into individual sentences, embeds each one, and measures the distance between adjacent sentence vectors. Wherever that distance spikes past a calibrated threshold — typically some number of standard deviations above the document's normal sentence-to-sentence drift — it declares a topic transition and cuts between the two sentences. The chunks come out remarkably self-contained.

Two things are commonly misstated about it. First, no LLM is involved: an *embedding* model represents the meaning, and the topic-shift detection itself is plain vector arithmetic. Second, the expensive part is not that arithmetic — it is having to run an embedding pass over every sentence in the corpus, which is what makes semantic splitting slow and costly at ingestion time.

## ② Embedding: turning text into coordinates {#embedding}

*Both ② boxes in the [pipeline diagram](#pipeline-diagram) — one model, used on both paths.*

A database can't compare meanings; it compares numbers. So every chunk is translated into a mathematical object it *can* index — a **vector**, a fixed-length list of numbers — by a **bi-encoder**.

A bi-encoder maps text into a single high-dimensional vector space, emitting a **dense** vector of typically 768 to 1,536 floating-point values. "Dense" means every one of those numbers carries signal, as opposed to the mostly-zero vectors keyword methods produce. The model is trained so that texts sharing a meaning land near each other in that space *even when they share no vocabulary*: "how do I reset my password" and "steps to recover account access" end up neighbours, while "quarterly revenue by region" sits far away. Picture each chunk as a point in a space of hundreds of dimensions, where distance is disagreement in meaning.

### Why "bi"-encoder {#bi-encoder}

The name describes the wiring: a chunk and a query go through two entirely independent passes, and the model never sees the two together.

Wiring it that way is only possible because of something the model can genuinely do — place a piece of text at an **absolute** position in a space it learned once, during training, from meaning alone. "Steps to recover account access" gets its coordinates from what it means, and from nothing else: not from the chunks around it, not from the size or contents of the corpus, and not from a question nobody has asked yet. Two texts written years apart by people who never met land next to each other because the same learned map placed them both — never because anything ever held them side by side and compared them.

That ability is what lets the offline path exist. A chunk's vector is correct for every question anyone will ever ask, so you can compute all of them months in advance and store them, and a question only has to be embedded once, live, in a few milliseconds.

Now imagine a model that required both texts in the same pass, scoring the pair directly. It emits no chunk vector at all — only a relevance score for the pair in front of it — so there is nothing to store ahead of time, and every question means running the model once per chunk: five million model calls to answer one question.

What separates the two designs is *where the comparison happens*. In the paired model it happens inside the model itself — which is why it can never be done ahead of time, and never cheaply. In a bi-encoder the model's job stops at turning text into numbers; that is the expensive part, and it runs once per chunk, offline. The comparison then drops down into the vector database, which has nothing harder to do than arithmetic on numbers already sitting on disk. Arithmetic at that scale is exactly what a vector index is built for, and that is what turns retrieval from a scan into a lookup.

That trade also caps how accurate retrieval can be, and [the next lesson](rag-in-production) brings the paired model back in a place where it's affordable.

### Measuring "close": cosine vs L2

At query time, nearness has to be an actual number. Two metrics show up:

- **Cosine similarity** measures the cosine of the angle between two vectors and ignores their lengths entirely. It asks whether they point the same way — whether they mean the same thing — not how much text is behind them. That makes it the default for RAG, where a five-word question has to be matched against a multi-sentence chunk.
- **Euclidean (L2) distance** measures the straight-line distance between two points, and unlike cosine it is sensitive to vector magnitude. It belongs in systems where magnitude itself is meaningful signal.

:::note
Choosing between them sounds like a real decision. Usually it isn't. If the vectors are **normalized** to unit length — which most embedding models do by default — then L2 and cosine produce the *same ranking*, and picking between them changes nothing but the number you print. The two only come apart on unnormalized vectors, where magnitude can shift the ranking on its own. So: normalize and use cosine, unless magnitude is signal you specifically want.
:::

## ③ The vector store: searching millions of vectors fast {#vector-store}

*Both ③ boxes in the [pipeline diagram](#pipeline-diagram) — one component, written by ingestion and read by inference.*

Where do a few million vectors live, and how do you find the nearest one in milliseconds?

Not in a B-tree or a hash index.<Sidenote>Those are covered in [Finding the needle](/system-design/building-blocks/finding-the-needle) — and both assume an ordering or an exact key, neither of which exists in 1,536 dimensions.</Sidenote> Those structures answer "equal to this" or "between these two values"; a vector query asks "nearest point in 1,536-dimensional space," which has no such ordering to exploit. The honest alternative is brute force: compute the distance from the query to every stored vector. That is linear in the number of records, and at a few million rows it stalls production traffic.

To hold a sub-hundred-millisecond retrieval budget, vector stores use **Approximate Nearest Neighbor (ANN)** indexes. The name describes a *family* of algorithms rather than one algorithm, and every member strikes the same bargain: surrender a sliver of **recall** — the fraction of the genuinely best matches that the search actually returns — in exchange for an enormous speedup. Four structures are worth knowing, and only two of them are actually ANN indexes: IVF and HNSW. Of the other two, a flat index is exact rather than approximate, and product quantization is a compression scheme that rides underneath an index rather than a way of searching.

### Flat index

No index structure at all: at query time, compute the exact distance to every stored vector. It never misses the best match, because it checks everything. But its query time grows linearly with the dataset, which rules it out at enterprise scale while leaving it a perfectly reasonable choice for small, isolated collections — a per-tenant store under roughly ten thousand chunks.

### Inverted file index (IVF)

Partitions the space by clustering. When the index is built, an unsupervised algorithm (k-means, typically) groups the vectors into clusters, each summarized by a central anchor point called a **centroid**. At query time the system compares the query against the centroids only, picks the closest cluster, and searches exclusively inside that bucket. The number of distance calculations collapses from millions to thousands.

Its weakness is the cluster border: a highly relevant vector that happens to sit just outside the chosen cluster is never examined. In practice you tune that away by probing the *n* nearest clusters rather than one, trading speed back for recall. Worth being precise about what IVF does and doesn't save: it cuts search *time*, not memory — every full vector is still stored.

<figure className="diagram">
<svg viewBox="0 0 700 236" width="700" height="236" role="img" aria-label="An IVF index. Vectors are grouped into three clusters, each with a centroid. The query lands nearest to cluster A's centroid, so only cluster A is searched. The vector closest to the query of all actually sits just inside cluster B, across the border, and is therefore never examined.">
  <defs>
    <marker id="rag-ivf-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <circle className="d-accent-stroke" cx="150" cy="110" r="75" strokeWidth="1.5" strokeDasharray="5 4" />
  <circle className="d-stroke" cx="340" cy="110" r="75" strokeWidth="1.5" strokeDasharray="5 4" />
  <circle className="d-stroke" cx="540" cy="80" r="52" strokeWidth="1.5" strokeDasharray="5 4" />
  <text className="d-label" x="150" y="28" fontSize="11" textAnchor="middle">cluster A — searched</text>
  <text className="d-label" x="340" y="28" fontSize="11" textAnchor="middle">cluster B — skipped</text>
  <text className="d-label" x="540" y="22" fontSize="11" textAnchor="middle">cluster C — skipped</text>
  <circle cx="105" cy="85" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="140" cy="70" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="185" cy="95" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="100" cy="135" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="145" cy="145" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="195" cy="140" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="160" cy="112" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="300" cy="70" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="350" cy="65" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="385" cy="100" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="320" cy="145" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="370" cy="140" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="520" cy="55" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="555" cy="60" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="570" cy="90" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="515" cy="100" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle cx="545" cy="105" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <rect className="d-accent" x="146" y="106" width="8" height="8" />
  <rect className="d-accent" x="336" y="106" width="8" height="8" />
  <rect className="d-accent" x="536" y="76" width="8" height="8" />
  <text className="d-label" x="150" y="131" fontSize="10" textAnchor="middle">centroid</text>
  <circle cx="268" cy="110" r="3.5" fill="currentColor" fillOpacity="0.5" />
  <circle className="d-accent-stroke" cx="268" cy="110" r="9" strokeWidth="1.5" />
  <line className="d-accent-stroke" x1="268" y1="121" x2="268" y2="200" strokeWidth="1" strokeDasharray="3 3" />
  <text className="d-label" x="196" y="217" fontSize="11" textAnchor="start">closest vector of all — but it sits in B, so it is never examined</text>
  <line className="d-accent-stroke" x1="232" y1="104" x2="238" y2="116" strokeWidth="2" />
  <line className="d-accent-stroke" x1="238" y1="104" x2="232" y2="116" strokeWidth="2" />
  <text className="d-label" x="235" y="95" fontSize="11" textAnchor="middle">query</text>
  <line className="d-accent-stroke" x1="228" y1="110" x2="162" y2="110" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#rag-ivf-arrow)" />
</svg>
<figcaption>The query is compared against the three centroids only, not the vectors. Cluster A wins, so the search never leaves it — and the genuinely closest vector, sitting just over the border inside B, is missed. Probing the two nearest clusters instead of one would catch it, for twice the work.</figcaption>
</figure>

### Hierarchical Navigable Small World (HNSW)

The modern production standard. It builds a multi-layered graph over the dataset. The upper layers are sparse, with long-range links that let a search leap across wide stretches of the space in a few hops; as the search closes in on the query's neighbourhood, it drops down through progressively denser layers of short links and finishes in roughly logarithmic time. The result is exceptional speed at high recall. The cost is memory: the entire multi-layer graph has to stay resident in RAM.

<figure className="diagram">
<svg viewBox="0 0 700 250" width="700" height="250" role="img" aria-label="An HNSW index drawn as three layers. The top layer holds a few nodes joined by long links, the middle layer more nodes with medium links, and the bottom layer every vector joined to its near neighbours. A search enters at the top left, takes one long hop, drops into the middle layer, takes a shorter hop, drops into the bottom layer and finishes at the target node two steps later.">
  <defs>
    <marker id="rag-hnsw-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <line className="d-stroke" x1="87" y1="45" x2="313" y2="45" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="327" y1="45" x2="553" y2="45" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <circle cx="80" cy="45" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="320" cy="45" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="560" cy="45" r="6" fill="currentColor" fillOpacity="0.45" />
  <text className="d-label" x="28" y="49" fontSize="11" textAnchor="middle">L2</text>
  <line className="d-stroke" x1="87" y1="130" x2="193" y2="130" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="207" y1="130" x2="313" y2="130" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="327" y1="130" x2="433" y2="130" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="447" y1="130" x2="553" y2="130" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <circle cx="80" cy="130" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="200" cy="130" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="320" cy="130" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="440" cy="130" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="560" cy="130" r="6" fill="currentColor" fillOpacity="0.45" />
  <text className="d-label" x="28" y="134" fontSize="11" textAnchor="middle">L1</text>
  <line className="d-stroke" x1="87" y1="215" x2="133" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="147" y1="215" x2="193" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="207" y1="215" x2="253" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="267" y1="215" x2="313" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="327" y1="215" x2="373" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="387" y1="215" x2="433" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="447" y1="215" x2="493" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="507" y1="215" x2="553" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <line className="d-stroke" x1="567" y1="215" x2="613" y2="215" strokeWidth="1" strokeDasharray="0" opacity="0.45" />
  <circle cx="80" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="140" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="200" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="260" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="320" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="380" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="440" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="500" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="560" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <circle cx="620" cy="215" r="6" fill="currentColor" fillOpacity="0.45" />
  <text className="d-label" x="28" y="219" fontSize="11" textAnchor="middle">L0</text>
  <line className="d-accent-stroke" x1="87" y1="45" x2="311" y2="45" strokeWidth="2" markerEnd="url(#rag-hnsw-arrow)" />
  <line className="d-accent-stroke" x1="327" y1="130" x2="431" y2="130" strokeWidth="2" markerEnd="url(#rag-hnsw-arrow)" />
  <line className="d-accent-stroke" x1="447" y1="215" x2="491" y2="215" strokeWidth="2" markerEnd="url(#rag-hnsw-arrow)" />
  <line className="d-accent-stroke" x1="320" y1="52" x2="320" y2="122" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#rag-hnsw-arrow)" />
  <line className="d-accent-stroke" x1="440" y1="137" x2="440" y2="207" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#rag-hnsw-arrow)" />
  <circle className="d-accent-stroke" cx="500" cy="215" r="11" strokeWidth="1.5" />
  <text className="d-label" x="80" y="26" fontSize="11" textAnchor="middle">entry point</text>
  <text className="d-label" x="500" y="243" fontSize="11" textAnchor="middle">target</text>
  <text className="d-label" x="690" y="28" fontSize="10.5" textAnchor="end">few nodes, long hops</text>
  <text className="d-label" x="690" y="113" fontSize="10.5" textAnchor="end">more nodes, shorter hops</text>
  <text className="d-label" x="690" y="190" fontSize="10.5" textAnchor="end">every vector, nearest-neighbour links</text>
</svg>
<figcaption>Each layer up holds a thinning sample of the vectors below it. The search crosses most of the dataset in one hop at the top, then refines downward — which is where the roughly logarithmic cost comes from. Every layer is a graph that must sit in RAM, which is where the memory cost comes from.</figcaption>
</figure>

### Product Quantization (PQ)

Not a search structure but a **lossy compression** scheme for the vectors themselves, typically layered underneath an index like IVF or HNSW rather than used alone. The problem it solves is pure infrastructure budget. A single 1,024-dimension vector of 32-bit floats occupies about 4,096 bytes; ten million chunks therefore need roughly **41 GB of RAM** for the raw vectors alone, before any graph or index overhead — that is expensive hardware sitting idle most of the day.

PQ cuts each vector into small sub-vectors — say 128 of them, 8 dimensions apiece — and replaces each one with a single-byte code: the ID of the nearest entry in a small learned table of representative sub-vectors. That 4,096-byte vector shrinks to something like **64 to 128 bytes**, and the same ten million chunks now fit in about **1 GB**. The penalty is precision — distances computed from rounded codes are slightly wrong, so some rankings come out wrong with them.

<figure className="diagram">
<svg viewBox="0 0 700 212" width="700" height="212" role="img" aria-label="Product quantization. One vector of 1,024 floats, occupying 4,096 bytes, is cut into 128 sub-vectors of 8 dimensions each. Every sub-vector is replaced by a one-byte code, the identifier of its nearest entry in a learned codebook, so the whole vector is stored as 128 codes — 128 bytes in total, thirty-two times smaller.">
  <defs>
    <marker id="rag-pq-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <text className="d-label" x="20" y="24" fontSize="12" textAnchor="start">one vector — 1,024 floats × 4 bytes = 4,096 B</text>
  <rect className="d-fill" x="20" y="36" width="660" height="34" rx="5" />
  <rect className="d-stroke" x="20" y="36" width="660" height="34" rx="5" strokeWidth="1.5" />
  <line className="d-stroke" x1="102.5" y1="36" x2="102.5" y2="70" strokeWidth="1" strokeDasharray="3 3" />
  <line className="d-stroke" x1="185.0" y1="36" x2="185.0" y2="70" strokeWidth="1" strokeDasharray="3 3" />
  <line className="d-stroke" x1="267.5" y1="36" x2="267.5" y2="70" strokeWidth="1" strokeDasharray="3 3" />
  <line className="d-stroke" x1="350.0" y1="36" x2="350.0" y2="70" strokeWidth="1" strokeDasharray="3 3" />
  <line className="d-stroke" x1="432.5" y1="36" x2="432.5" y2="70" strokeWidth="1" strokeDasharray="3 3" />
  <line className="d-stroke" x1="515.0" y1="36" x2="515.0" y2="70" strokeWidth="1" strokeDasharray="3 3" />
  <line className="d-stroke" x1="597.5" y1="36" x2="597.5" y2="70" strokeWidth="1" strokeDasharray="3 3" />
  <text className="d-text" x="61.2" y="58" fontSize="10" textAnchor="middle">8 dims</text>
  <text className="d-text" x="143.8" y="58" fontSize="10" textAnchor="middle">8 dims</text>
  <text className="d-text" x="226.2" y="58" fontSize="10" textAnchor="middle">8 dims</text>
  <text className="d-text" x="308.8" y="58" fontSize="10" textAnchor="middle">8 dims</text>
  <text className="d-text" x="391.2" y="58" fontSize="10" textAnchor="middle">8 dims</text>
  <text className="d-text" x="473.8" y="58" fontSize="10" textAnchor="middle">…</text>
  <text className="d-text" x="556.2" y="58" fontSize="10" textAnchor="middle">8 dims</text>
  <text className="d-text" x="638.8" y="58" fontSize="10" textAnchor="middle">8 dims</text>
  <text className="d-label" x="20" y="88" fontSize="11" textAnchor="start">128 sub-vectors of 8 dimensions</text>
  <line className="d-accent-stroke" x1="350" y1="92" x2="350" y2="120" strokeWidth="1.5" markerEnd="url(#rag-pq-arrow)" />
  <text className="d-label" x="366" y="110" fontSize="10.5" textAnchor="start">replace each with its nearest codebook ID</text>
  <rect className="d-fill" x="44.2" y="128" width="34" height="28" rx="4" />
  <rect className="d-stroke" x="44.2" y="128" width="34" height="28" rx="4" strokeWidth="1.5" />
  <text className="d-text" x="61.2" y="147" fontSize="11" textAnchor="middle">37</text>
  <rect className="d-fill" x="126.8" y="128" width="34" height="28" rx="4" />
  <rect className="d-stroke" x="126.8" y="128" width="34" height="28" rx="4" strokeWidth="1.5" />
  <text className="d-text" x="143.8" y="147" fontSize="11" textAnchor="middle">112</text>
  <rect className="d-fill" x="209.2" y="128" width="34" height="28" rx="4" />
  <rect className="d-stroke" x="209.2" y="128" width="34" height="28" rx="4" strokeWidth="1.5" />
  <text className="d-text" x="226.2" y="147" fontSize="11" textAnchor="middle">5</text>
  <rect className="d-fill" x="291.8" y="128" width="34" height="28" rx="4" />
  <rect className="d-stroke" x="291.8" y="128" width="34" height="28" rx="4" strokeWidth="1.5" />
  <text className="d-text" x="308.8" y="147" fontSize="11" textAnchor="middle">201</text>
  <rect className="d-fill" x="374.2" y="128" width="34" height="28" rx="4" />
  <rect className="d-stroke" x="374.2" y="128" width="34" height="28" rx="4" strokeWidth="1.5" />
  <text className="d-text" x="391.2" y="147" fontSize="11" textAnchor="middle">64</text>
  <rect className="d-fill" x="456.8" y="128" width="34" height="28" rx="4" />
  <rect className="d-stroke" x="456.8" y="128" width="34" height="28" rx="4" strokeWidth="1.5" />
  <text className="d-text" x="473.8" y="147" fontSize="11" textAnchor="middle">…</text>
  <rect className="d-fill" x="539.2" y="128" width="34" height="28" rx="4" />
  <rect className="d-stroke" x="539.2" y="128" width="34" height="28" rx="4" strokeWidth="1.5" />
  <text className="d-text" x="556.2" y="147" fontSize="11" textAnchor="middle">9</text>
  <rect className="d-fill" x="621.8" y="128" width="34" height="28" rx="4" />
  <rect className="d-stroke" x="621.8" y="128" width="34" height="28" rx="4" strokeWidth="1.5" />
  <text className="d-text" x="638.8" y="147" fontSize="11" textAnchor="middle">88</text>
  <text className="d-label" x="20" y="184" fontSize="12" textAnchor="start">128 codes × 1 byte = 128 B — the same vector, 32× smaller</text>
</svg>
<figcaption>A codebook is a short list of typical sub-vectors learned from the data, one codebook per slice of the vector. Storing the code <code>37</code> in place of that sub-vector's eight floats is where the 32× saving comes from, and rounding each sub-vector to its nearest codebook entry is where the lost precision comes from.</figcaption>
</figure>

---

That is the complete naive pipeline, and it works beautifully on a demo corpus of twenty tidy documents. Real company data breaks it in four specific ways — [the next lesson](rag-in-production) walks through each failure and the layer that fixes it.
