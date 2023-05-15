import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import md from "./core/resources/markdown.md";

const App = () => {
  const [markdown, setMarkdown] = useState("");

  useEffect(() => {
    fetch(md)
      .then((res) => res.text())
      .then((text) => setMarkdown(text));
  }, []);

  return (
    <div className="prose max-w-[60em] mx-auto my-24 prose-slate bg-slate-50 p-12 prose-code:bg-slate-200 prose-code:rounded-lg prose-code:p-1 prose-h1:text-blue-600 prose-h2:text-blue-500 prose-h3:text-blue-400">
      <ReactMarkdown children={markdown} />
    </div>
  );
};

export default App;
