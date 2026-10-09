# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - button "More options" [ref=e8]: event_list
    - generic [ref=e13]: lens_blur
    - generic [ref=e15]:
      - textbox "Ask about isolation-a..." [active] [ref=e19]: exact composing draft
      - generic [ref=e20]:
        - generic [ref=e21]:
          - button "Add" [ref=e23] [cursor=pointer]:
            - generic [ref=e24]: add
          - button "Mode" [ref=e26]: shield_lockMode
        - generic [ref=e27]:
          - 'button "Context usage: 0%" [ref=e29]'
          - button "DeepSeek V4 Flash" [ref=e31]: DeepSeek V4 Flashkeyboard_arrow_down
          - button "Voice input (click to open)" [ref=e33] [cursor=pointer]:
            - generic [ref=e34]: mic
          - button "stop" [ref=e35]
  - generic [ref=e37]:
    - button "More options" [ref=e40]: event_list
    - generic [ref=e43]: Start a conversation
    - generic [ref=e45]:
      - textbox "Ask about isolation-b..." [ref=e49]
      - generic [ref=e50]:
        - generic [ref=e51]:
          - button "Add" [ref=e53] [cursor=pointer]:
            - generic [ref=e54]: add
          - button "Mode" [ref=e56]: shield_lockMode
        - generic [ref=e57]:
          - 'button "Context usage: 0%" [ref=e59]'
          - button "DeepSeek V4 Flash" [ref=e61]: DeepSeek V4 Flashkeyboard_arrow_down
          - button "Voice input (click to open)" [ref=e63] [cursor=pointer]:
            - generic [ref=e64]: mic
          - button "Send message" [ref=e66]: arrow_upward
```