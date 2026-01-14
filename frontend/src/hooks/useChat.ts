import { useCallback, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  toolsUsed?: string[];
}

export interface ChatContext {
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
}

interface UseChatOptions {
  context?: ChatContext;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      setError(null);
      setIsLoading(true);

      // Add user message
      const userMessageId = `user-${Date.now()}`;
      const newUserMessage: ChatMessage = {
        role: "user",
        content: userMessage,
        id: userMessageId,
      };

      setMessages((prev) => [...prev, newUserMessage]);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      try {
        // Build messages array for API (excluding IDs)
        const apiMessages = [...messages, newUserMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch(`${apiUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            messages: apiMessages,
            context: options.context,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `API error: ${response.status} ${response.statusText}`
          );
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Process Server-Sent Events
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        const assistantMessageId = `assistant-${Date.now()}`;
        let messageAdded = false;
        const toolsUsed: string[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(line.substring(6));

              if (data.type === "text_delta") {
                assistantContent += data.text;

                if (!messageAdded) {
                  // Add assistant message on first delta
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: data.text,
                      id: assistantMessageId,
                      toolsUsed: toolsUsed.length > 0 ? [...toolsUsed] : undefined,
                    },
                  ]);
                  messageAdded = true;
                } else {
                  // Update existing assistant message
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: assistantContent, toolsUsed: toolsUsed.length > 0 ? [...toolsUsed] : undefined }
                        : m
                    )
                  );
                }
              } else if (data.type === "tool_use_start") {
                setActiveTool(data.tool);
                if (!toolsUsed.includes(data.tool)) {
                  toolsUsed.push(data.tool);
                }
              } else if (data.type === "tool_executing") {
                setActiveTool(data.tool);
              } else if (data.type === "tool_result") {
                setActiveTool(null);
              } else if (data.type === "message_stop") {
                setActiveTool(null);
                break;
              } else if (data.type === "error") {
                setActiveTool(null);
                throw new Error(data.error);
              }
            } catch (e) {
              // Skip malformed JSON lines
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled - don't show error
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options.context]
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    activeTool,
    sendMessage,
    cancel,
    clearMessages,
  };
}
