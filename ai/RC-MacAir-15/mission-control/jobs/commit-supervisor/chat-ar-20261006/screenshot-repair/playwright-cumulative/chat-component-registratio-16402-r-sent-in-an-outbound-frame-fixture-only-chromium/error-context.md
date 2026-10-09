# Page snapshot

```yaml
- generic [ref=e3]:
  - tablist "Component chat tab" [ref=e5]:
    - tab "Chat surface" [selected] [ref=e6] [cursor=pointer]:
      - generic [ref=e7]: chat
      - generic [ref=e8]: Chat surface
    - button "Close Chat surface" [ref=e9] [cursor=pointer]:
      - generic [ref=e10]: close
  - tabpanel "Chat surface" [ref=e11]:
    - generic [ref=e14]:
      - button "More options" [ref=e17]: event_list
      - generic [ref=e21]: CHAT-COMPONENT-TRUTH
      - generic [ref=e23]:
        - status [ref=e24]: Message not sent. Check the connection and try again.
        - textbox "Ask about chat-surface-component-chat-component-instance-1..." [active] [ref=e28]: HELLO-COMPONENT
        - generic [ref=e29]:
          - generic [ref=e30]:
            - button "Add" [ref=e32] [cursor=pointer]:
              - generic [ref=e33]: add
            - button "Mode" [ref=e35]: shield_lockMode
          - generic [ref=e36]:
            - 'button "Context usage: 0%" [ref=e38]'
            - button "DeepSeek V4 Flash" [ref=e40]: DeepSeek V4 Flashkeyboard_arrow_down
            - button "Voice input (click to open)" [ref=e42] [cursor=pointer]:
              - generic [ref=e43]: mic
            - button "Send message" [ref=e45]: arrow_upward
```