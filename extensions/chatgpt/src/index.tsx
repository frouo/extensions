import { Form, ActionPanel, Action, Detail } from "@raycast/api";
import { useEffect, useState } from "react";
import { Data, useChatGPT } from "./chatgpt";

export default function Command() {
  type Values = {
    textarea: string;
  };

  const [text, setText] = useState("");
  const [inputText, setInputText] = useState<string>();
  const [textError, setTextError] = useState<string | undefined>();
  const [data, setData] = useState<Data[]>([]);

  const latestData = [...data].pop();
  const conversationId = latestData?.conversation_id;
  const parentMessageId = latestData?.message.id;
  const latestMessageText = latestData?.message.content.parts.join("");

  const { data: newData, error, isFetching } = useChatGPT(inputText, conversationId, parentMessageId);

  useEffect(() => {
    if (newData) {
      setData((prevData) => [...prevData.filter((e) => e.message.id !== newData.message.id), newData]);
    }
  }, [newData]);

  function handleSubmit(values: Values) {
    if (values.textarea) {
      setText("");
      setInputText(values.textarea);
      setTextError(undefined);
    } else {
      setTextError("Required");
    }
  }

  const handleStartNewConversation = () => {
    setData([]);
  };

  return (
    <Form
      isLoading={isFetching}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={data.length === 0 ? "Submit text" : "Submit reply"} onSubmit={handleSubmit} />
          <Action title="Start a new conversation" onAction={handleStartNewConversation} />
          {latestMessageText && (
            <Action.Push
              title="Open response"
              target={<Detail markdown={latestMessageText} />}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="textarea"
        value={text}
        onChange={setText}
        placeholder={data.length === 0 ? "New chat" : "Continue chatting"}
        error={textError}
      />
      {error && <Form.Description title="Error" text={error} />}
      {[...data].reverse().map((d, kIdx) => {
        if (d.message.role === "assistant") {
          return <Form.Description key={kIdx} title="ChatGPT" text={d.message.content.parts.join("")} />;
        } else {
          return <Form.Description key={kIdx} title="Me" text={d.message.content.parts.join("")} />;
        }
      })}
    </Form>
  );
}
