import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "../auth";

const app = new Hono();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context: {
    structureContent?: string;
    structureFormat?: "pdb" | "mmcif";
    referenceBinderName?: string;
    referenceBinderType?: string;
    pdbId?: string;
    chainInfo?: Array<{
      id: string;
      entityDescription?: string;
      role?: "target" | "binder" | "context";
    }>;
    scores?: {
      compositeScore?: number | null;
      plddt?: number | null;
      ptm?: number | null;
      ipSaeScore?: number | null;
      interfaceArea?: number | null;
    };
    challengeName?: string;
  };
}

// Tool definitions
const tools: Anthropic.Tool[] = [
  {
    name: "fetch_pdb_metadata",
    description:
      "Fetch metadata about a PDB structure from the RCSB PDB database. Returns information like title, authors, resolution, experimental method, release date, and more.",
    input_schema: {
      type: "object" as const,
      properties: {
        pdb_id: {
          type: "string",
          description: "The 4-character PDB ID (e.g., '5X8L', '1HZH')",
        },
      },
      required: ["pdb_id"],
    },
  },
  {
    name: "fetch_uniprot_info",
    description:
      "Fetch protein information from UniProt database. Returns protein name, function, gene name, organism, and key features.",
    input_schema: {
      type: "object" as const,
      properties: {
        accession: {
          type: "string",
          description:
            "UniProt accession number (e.g., 'P01308' for insulin, 'Q9Y6K9' for CD274/PD-L1)",
        },
      },
      required: ["accession"],
    },
  },
  {
    name: "search_pdb",
    description:
      "Search the PDB database for structures matching a query. Useful for finding related structures or comparing to other binders.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query (e.g., 'PD-L1 antibody', 'insulin receptor')",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
        },
      },
      required: ["query"],
    },
  },
];

// Tool execution functions
async function fetchPdbMetadata(
  pdbId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(
      `https://data.rcsb.org/rest/v1/core/entry/${pdbId.toUpperCase()}`
    );
    if (!response.ok) {
      return { success: false, error: `PDB ID ${pdbId} not found` };
    }
    const data = await response.json();

    // Extract key information
    return {
      success: true,
      data: {
        pdb_id: data.entry?.id,
        title: data.struct?.title,
        authors: data.audit_author?.map((a: any) => a.name).join(", "),
        release_date: data.rcsb_accession_info?.initial_release_date,
        experimental_method: data.exptl?.[0]?.method,
        resolution: data.rcsb_entry_info?.resolution_combined?.[0],
        organism: data.rcsb_entry_info?.polymer_entity_count_protein,
        keywords: data.struct_keywords?.pdbx_keywords,
        citation_title: data.citation?.[0]?.title,
        citation_journal: data.citation?.[0]?.journal_abbrev,
        citation_year: data.citation?.[0]?.year,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch PDB metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function fetchUniprotInfo(
  accession: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(
      `https://rest.uniprot.org/uniprotkb/${accession}.json`
    );
    if (!response.ok) {
      return { success: false, error: `UniProt accession ${accession} not found` };
    }
    const data = await response.json();

    // Extract key information
    const proteinName =
      data.proteinDescription?.recommendedName?.fullName?.value ||
      data.proteinDescription?.submittedName?.[0]?.fullName?.value;
    const geneName = data.genes?.[0]?.geneName?.value;
    const organism = data.organism?.scientificName;
    const functionComment = data.comments?.find(
      (c: any) => c.commentType === "FUNCTION"
    );
    const subcellularComment = data.comments?.find(
      (c: any) => c.commentType === "SUBCELLULAR LOCATION"
    );

    return {
      success: true,
      data: {
        accession: data.primaryAccession,
        protein_name: proteinName,
        gene_name: geneName,
        organism: organism,
        function: functionComment?.texts?.[0]?.value,
        subcellular_location:
          subcellularComment?.subcellularLocations?.[0]?.location?.value,
        sequence_length: data.sequence?.length,
        keywords: data.keywords?.map((k: any) => k.name).slice(0, 10),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch UniProt info: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function searchPdb(
  query: string,
  maxResults: number = 5
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const searchQuery = {
      query: {
        type: "terminal",
        service: "full_text",
        parameters: {
          value: query,
        },
      },
      return_type: "entry",
      request_options: {
        paginate: {
          start: 0,
          rows: maxResults,
        },
        scoring_strategy: "combined",
        sort: [{ sort_by: "score", direction: "desc" }],
      },
    };

    const response = await fetch("https://search.rcsb.org/rcsbsearch/v2/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchQuery),
    });

    if (!response.ok) {
      return { success: false, error: "PDB search failed" };
    }

    const data = await response.json();
    const results = data.result_set?.slice(0, maxResults) || [];

    // Fetch titles for each result
    const enrichedResults = await Promise.all(
      results.map(async (r: any) => {
        try {
          const entryResponse = await fetch(
            `https://data.rcsb.org/rest/v1/core/entry/${r.identifier}`
          );
          if (entryResponse.ok) {
            const entryData = await entryResponse.json();
            return {
              pdb_id: r.identifier,
              title: entryData.struct?.title,
              score: r.score,
            };
          }
        } catch {
          // Ignore individual fetch errors
        }
        return { pdb_id: r.identifier, score: r.score };
      })
    );

    return {
      success: true,
      data: {
        total_count: data.total_count,
        results: enrichedResults,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to search PDB: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function executeTool(
  toolName: string,
  toolInput: any
): Promise<string> {
  switch (toolName) {
    case "fetch_pdb_metadata": {
      const result = await fetchPdbMetadata(toolInput.pdb_id);
      return JSON.stringify(result, null, 2);
    }
    case "fetch_uniprot_info": {
      const result = await fetchUniprotInfo(toolInput.accession);
      return JSON.stringify(result, null, 2);
    }
    case "search_pdb": {
      const result = await searchPdb(toolInput.query, toolInput.max_results);
      return JSON.stringify(result, null, 2);
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

function buildSystemPrompt(context: ChatRequest["context"]): string {
  let prompt = `You are an expert structural biologist and protein design advisor. You help users understand protein structures, interpret scores, and learn about protein-protein interactions.

Your role:
- Answer questions about the protein structure being viewed
- Explain what different chains represent (antibodies, targets, etc.)
- Interpret structural scores (pLDDT, pTM, ipSAE, interface area)
- Provide educational context about protein design
- Use your tools to look up additional information when helpful

You have access to tools for looking up PDB metadata, UniProt protein information, and searching for related structures. Use these tools when the user asks about:
- Details about the protein or structure not visible in the current data
- The biological function of proteins
- Related structures or similar binders
- Publication or experimental details

Format your responses using markdown for better readability:
- Use **bold** for emphasis
- Use bullet points for lists
- Use \`code\` for residue numbers or technical terms
- Use headers (##) for organizing longer responses

Keep responses focused and practical. Use technical terminology but explain it when helpful.`;

  if (context.referenceBinderName) {
    prompt += `

The user is viewing a reference binder structure: "${context.referenceBinderName}"`;
    if (context.referenceBinderType) {
      prompt += ` (Type: ${context.referenceBinderType})`;
    }
  }

  if (context.pdbId) {
    prompt += `
PDB ID: ${context.pdbId}`;
  }

  if (context.challengeName) {
    prompt += `
Associated challenge: ${context.challengeName}`;
  }

  if (context.chainInfo && context.chainInfo.length > 0) {
    prompt += `

Chains in this structure:`;
    for (const chain of context.chainInfo) {
      prompt += `
- Chain ${chain.id}${chain.role ? ` (${chain.role})` : ""}: ${chain.entityDescription || "Unknown"}`;
    }
  }

  if (context.scores) {
    const scores = context.scores;
    const scoreLines: string[] = [];
    if (scores.compositeScore !== null && scores.compositeScore !== undefined) {
      scoreLines.push(`Composite Score: ${scores.compositeScore.toFixed(1)}`);
    }
    if (scores.plddt !== null && scores.plddt !== undefined) {
      scoreLines.push(`pLDDT: ${scores.plddt.toFixed(1)} (confidence, higher is better, >90 excellent)`);
    }
    if (scores.ptm !== null && scores.ptm !== undefined) {
      scoreLines.push(`pTM: ${scores.ptm.toFixed(2)} (topology, higher is better, >0.7 good)`);
    }
    if (scores.ipSaeScore !== null && scores.ipSaeScore !== undefined) {
      scoreLines.push(`ipSAE: ${scores.ipSaeScore.toFixed(2)} (interface quality, lower is better, <-0.7 good)`);
    }
    if (scores.interfaceArea !== null && scores.interfaceArea !== undefined) {
      scoreLines.push(`Interface Area: ${scores.interfaceArea.toFixed(0)} Å²`);
    }

    if (scoreLines.length > 0) {
      prompt += `

Structural scores:
${scoreLines.join("\n")}`;
    }
  }

  if (context.structureContent) {
    // Truncate very large structures to avoid context limits
    const maxLength = 15000;
    const truncated = context.structureContent.length > maxLength;
    const content = truncated
      ? context.structureContent.substring(0, maxLength) + "\n... (truncated)"
      : context.structureContent;

    prompt += `

Structure file (${context.structureFormat || "pdb"} format):
\`\`\`
${content}
\`\`\``;
  }

  return prompt;
}

// POST /api/chat - Stream chat responses with protein context
app.post("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({ error: "Anthropic API key not configured" }, 500);
  }

  const body = (await c.req.json()) as ChatRequest;
  const { messages, context } = body;

  if (!messages || messages.length === 0) {
    return c.json({ error: "No messages provided" }, 400);
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildSystemPrompt(context || {});

  return streamSSE(c, async (stream) => {
    try {
      // Convert messages to Anthropic format
      let anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Agentic loop - keep processing until we get a final response
      let continueLoop = true;
      while (continueLoop) {
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: systemPrompt,
          messages: anthropicMessages,
          tools: tools,
          stream: true,
        });

        let currentToolUse: {
          id: string;
          name: string;
          input: string;
        } | null = null;
        let hasToolUse = false;
        const toolResults: Array<{
          type: "tool_result";
          tool_use_id: string;
          content: string;
        }> = [];
        let assistantContent: Anthropic.ContentBlock[] = [];

        for await (const event of response) {
          if (event.type === "content_block_start") {
            if (event.content_block.type === "tool_use") {
              hasToolUse = true;
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: "",
              };
              // Notify client that we're using a tool
              await stream.writeSSE({
                data: JSON.stringify({
                  type: "tool_use_start",
                  tool: event.content_block.name,
                }),
              });
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: "text_delta",
                  text: event.delta.text,
                }),
              });
            } else if (
              event.delta.type === "input_json_delta" &&
              currentToolUse
            ) {
              currentToolUse.input += event.delta.partial_json;
            }
          } else if (event.type === "content_block_stop") {
            if (currentToolUse) {
              // Execute the tool
              let toolInput: any;
              try {
                toolInput = JSON.parse(currentToolUse.input);
              } catch {
                toolInput = {};
              }

              await stream.writeSSE({
                data: JSON.stringify({
                  type: "tool_executing",
                  tool: currentToolUse.name,
                }),
              });

              const toolResult = await executeTool(
                currentToolUse.name,
                toolInput
              );

              toolResults.push({
                type: "tool_result",
                tool_use_id: currentToolUse.id,
                content: toolResult,
              });

              assistantContent.push({
                type: "tool_use",
                id: currentToolUse.id,
                name: currentToolUse.name,
                input: toolInput,
              });

              await stream.writeSSE({
                data: JSON.stringify({
                  type: "tool_result",
                  tool: currentToolUse.name,
                }),
              });

              currentToolUse = null;
            }
          } else if (event.type === "message_stop") {
            if (!hasToolUse) {
              continueLoop = false;
              await stream.writeSSE({
                data: JSON.stringify({ type: "message_stop" }),
              });
            }
          } else if (event.type === "message_delta") {
            if (event.delta.stop_reason === "end_turn") {
              continueLoop = false;
              await stream.writeSSE({
                data: JSON.stringify({ type: "message_stop" }),
              });
            }
          }
        }

        // If we had tool use, add the assistant message and tool results, then continue
        if (hasToolUse && toolResults.length > 0) {
          anthropicMessages.push({
            role: "assistant",
            content: assistantContent,
          });
          anthropicMessages.push({
            role: "user",
            content: toolResults,
          });
        } else {
          continueLoop = false;
        }
      }
    } catch (error) {
      console.error("Anthropic API error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await stream.writeSSE({
        data: JSON.stringify({
          type: "error",
          error: errorMessage,
        }),
      });
    }
  });
});

export default app;
