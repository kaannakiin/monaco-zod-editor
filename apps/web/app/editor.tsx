"use client";

import { useEffect, useState } from "react";
import { treeNodeDescriptor, treeNodeDefaultValue } from "@zod-monaco/core";
import { ZodMonacoEditor, loadMonaco, type MonacoApi } from "@zod-monaco/react";

export default function Editor() {
  const [monaco, setMonaco] = useState<MonacoApi | null>(null);

  useEffect(() => {
    loadMonaco().then(setMonaco);
  }, []);

  if (!monaco) {
    return (
      <div
        style={{
          minHeight: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(244, 247, 251, 0.5)",
          fontSize: 14,
        }}
      >
        Loading editor...
      </div>
    );
  }

  return (
    <ZodMonacoEditor
      monaco={monaco}
      descriptor={treeNodeDescriptor}
      defaultValue={treeNodeDefaultValue}
      editorOptions={{
        theme: "vs-dark",
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        padding: { top: 16 },
      }}
      style={{ borderRadius: 12, overflow: "hidden", height: "80vh" }}
    />
  );
}
