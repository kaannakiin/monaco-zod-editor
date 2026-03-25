"use client";

import { useEffect, useRef, useState } from "react";
import { treeNodeDescriptor, treeNodeDefaultValue } from "@zod-monaco/core";
import {
  loadMonaco,
  attachZodToEditor,
  locales,
  type MonacoApi,
} from "@zod-monaco/monaco";

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let monacoInstance: MonacoApi;
    let editor: ReturnType<MonacoApi["editor"]["create"]>;
    let attachment: ReturnType<typeof attachZodToEditor>;

    loadMonaco({
      onLoad(m) {
        m.editor.defineTheme("zod-dark", {
          base: "vs-dark",
          inherit: true,
          rules: [],
          colors: {
            "editor.background": "#0d1117",
          },
        });
      },
    }).then((monaco) => {
      if (disposed || !containerRef.current) return;
      monacoInstance = monaco;

      editor = monaco.editor.create(containerRef.current, {
        automaticLayout: true,
        language: "json",
        value: treeNodeDefaultValue,
        theme: "zod-dark",
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        padding: { top: 16 },
      });

      attachment = attachZodToEditor({
        monaco,
        editor,
        descriptor: treeNodeDescriptor,
        locale: locales.tr,
      });

      setLoading(false);
    });

    return () => {
      disposed = true;
      attachment?.dispose();
      editor?.dispose();
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        height: "80vh",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(244, 247, 251, 0.5)",
            fontSize: 14,
            zIndex: 1,
          }}
        >
          Loading editor...
        </div>
      )}
      <div ref={containerRef} style={{ height: "100%" }} />
    </div>
  );
}
