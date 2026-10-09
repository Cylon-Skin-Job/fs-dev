# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - button "More options" [ref=e8]: event_list
    - generic [ref=e11]: Start a conversation
    - generic [ref=e13]:
      - status [ref=e14]: Message not sent. Check the connection and try again.
      - textbox "Ask about isolation-a..." [ref=e18]: MSG-A
      - generic [ref=e19]:
        - generic [ref=e20]:
          - button "Add" [ref=e22] [cursor=pointer]:
            - generic [ref=e23]: add
          - button "Mode" [ref=e25]: shield_lockMode
        - generic [ref=e26]:
          - 'button "Context usage: 0%" [ref=e28]'
          - button "DeepSeek V4 Flash" [ref=e30]: DeepSeek V4 Flashkeyboard_arrow_down
          - button "Voice input (click to open)" [ref=e32] [cursor=pointer]:
            - generic [ref=e33]: mic
          - button "Send message" [ref=e35]: arrow_upward
  - generic [ref=e37]:
    - button "More options" [ref=e40]: event_list
    - generic [ref=e43]: Start a conversation
    - generic [ref=e45]:
      - status [ref=e46]: Message not sent. Check the connection and try again.
      - textbox "Ask about isolation-b..." [active] [ref=e50]: MSG-B
      - generic [ref=e51]:
        - generic [ref=e52]:
          - button "Add" [ref=e54] [cursor=pointer]:
            - generic [ref=e55]: add
          - button "Mode" [ref=e57]: shield_lockMode
        - generic [ref=e58]:
          - 'button "Context usage: 0%" [ref=e60]'
          - button "DeepSeek V4 Flash" [ref=e62]: DeepSeek V4 Flashkeyboard_arrow_down
          - button "Voice input (click to open)" [ref=e64] [cursor=pointer]:
            - generic [ref=e65]: mic
          - button "Send message" [ref=e67]: arrow_upward
```