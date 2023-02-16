import fetch from "node-fetch";
import prefs from "./prefs";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState } from "react";

export type Data = {
  message: Message;
  conversation_id: string;
  error: string | null;
};

type Message = {
  id: string;
  role: string;
  user: string | null;
  create_time: string | null;
  update_time: string | null;
  content: Content;
  end_turn: string | null;
  weight: number;
  metadata: Metadata;
  recipient: string;
};

type Content = {
  content_type: string;
  parts: string[];
};

type Metadata = {
  message_type: string;
  model_slug: string;
};

export const useChatGPT = (text?: string, conversationId?: string, parentMessageId?: string) => {
  const [data, setData] = useState<Data>();
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!text) {
      return;
    }

    setIsFetching(true);

    const newMessageId = generateId();
    const userQuestion: Data = {
      conversation_id: "unknown",
      // @ts-ignore
      message: { id: newMessageId, role: "user", content: { content_type: "text", parts: [text] } },
    };
    setData(userQuestion);

    if (conversationId && parentMessageId) {
      continueConversation(
        conversationId,
        parentMessageId,
        newMessageId,
        text,
        (data) => {
          setData(data);
        },
        () => setIsFetching(false),
        (status, statusText) => setError(`${status} ${statusText}`)
      );
    } else {
      startNewConversation(
        newMessageId,
        text,
        (data) => {
          setData(data);
        },
        () => setIsFetching(false),
        (status, statusText) => setError(`${status} ${statusText}`)
      );
    }
  }, [text]);

  return { data, error, isFetching };
};

export const generateId = () => uuidv4();

const fetchChatGPTStream = async (
  body: { [key: string]: any },
  onDataUpdate: (data: Data) => void,
  isDone: () => void,
  onError: (status: number, statusText: string) => void
) => {
  const response = await fetch("https://chat.openai.com/backend-api/conversation", {
    headers: {
      accept: "text/event-stream",
      authorization: `Bearer ${prefs.accessToken}`,
      "content-type": "application/json",
      "sec-ch-ua-platform": '"raycast.com/frouo/chatgpt"',
      cookie: `_puid=${prefs.puid}; __Secure-next-auth.session-token=${prefs.accessToken}`,
      Referer: "https://chat.openai.com/chat",
    },
    body: JSON.stringify(body),
    method: "POST",
  });

  if (!response.ok) {
    onError(response.status, response.statusText);
    isDone();
    return;
  }

  let results: Data[] = [];
  let completion = "";

  // @ts-ignore
  for await (const chunk of response.body) {
    const chunkAsString = `${chunk}`;
    completion += chunkAsString;

    const chunks = chunkAsString
      .split("data:")
      .map((e) => e.trim())
      .filter((e) => e)
      .map((e) => {
        try {
          return JSON.parse(e);
        } catch (err) {
          return undefined;
        }
      })
      .filter((e) => e) as Data[];

    results = [...results, ...chunks];

    if (results.length > 0) {
      onDataUpdate(results[results.length - 1]);
    }

    if (chunkAsString.trim().endsWith("[DONE]")) {
      isDone();
    }
  }
};

const startNewConversation = async (
  newId: string,
  text: string,
  onDataUpdate: (data: Data) => void,
  isDone: () => void,
  onError: (status: number, statusText: string) => void
) => {
  const body = {
    action: "next",
    messages: [
      {
        id: newId,
        role: "user",
        content: { content_type: "text", parts: [text] },
      },
    ],
    parent_message_id: uuidv4(),
    model: prefs.model || "text-davinci-002-render-sha",
  };

  await fetchChatGPTStream(body, onDataUpdate, isDone, onError);
};

const continueConversation = async (
  conversationId: string,
  previousMessageId: string,
  newId: string,
  text: string,
  onDataUpdate: (data: Data) => void,
  isDone: () => void,
  onError: (status: number, statusText: string) => void
) => {
  const body = {
    action: "next",
    messages: [
      {
        id: newId,
        role: "user",
        content: {
          content_type: "text",
          parts: [text],
        },
      },
    ],
    conversation_id: conversationId,
    parent_message_id: previousMessageId,
    model: prefs.model || "text-davinci-002-render-sha",
  };

  await fetchChatGPTStream(body, onDataUpdate, isDone, onError);
};
