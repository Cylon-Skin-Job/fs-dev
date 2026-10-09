# Page snapshot

```yaml
- generic [ref=e3]:
  - button "More options" [ref=e6]: event_list
  - generic [ref=e9]:
    - paragraph [ref=e11]: partial output
    - alert [ref=e12]:
      - generic [ref=e13]: Response failed
      - generic [ref=e14]: MODEL_RESPONSE_FAILED
      - generic [ref=e15]: The model response failed before it completed.
    - generic [ref=e16]:
      - generic "Diagnostic actions" [ref=e17]:
        - button "View" [disabled] [ref=e18]
        - button "Copy" [disabled] [ref=e19]
        - button "Ask AI" [disabled] [ref=e20]
      - generic [ref=e21]: Diagnostic details are unavailable.
    - generic [ref=e23]:
      - button "Copy reply" [disabled] [ref=e24]:
        - generic [ref=e25]: content_copy
      - button "Text to speech" [disabled] [ref=e26]:
        - generic [ref=e27]: text_to_speech
      - button "Add bookmark" [disabled] [ref=e28]:
        - generic [ref=e29]: bookmark
      - button "Chat ID" [disabled] [ref=e30]:
        - generic [ref=e31]: link_2
  - generic [ref=e33]:
    - textbox "Ask about chat-surface-component-diagnostic-instance..." [ref=e37]: PRESERVED-DRAFT
    - generic [ref=e38]:
      - generic [ref=e39]:
        - button "Add" [ref=e41] [cursor=pointer]:
          - generic [ref=e42]: add
        - button "Mode" [ref=e44]: shield_lockMode
      - generic [ref=e45]:
        - 'button "Context usage: 0%" [ref=e47]'
        - button "DeepSeek V4 Flash" [ref=e49]: DeepSeek V4 Flashkeyboard_arrow_down
        - button "Voice input (click to open)" [ref=e51] [cursor=pointer]:
          - generic [ref=e52]: mic
        - button "Send message" [ref=e54]: arrow_upward
```