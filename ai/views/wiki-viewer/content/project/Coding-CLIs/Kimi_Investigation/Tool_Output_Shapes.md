# Tool Output Shapes

The Kimi probes gave us a practical map for tool rendering.

## Shell

Shell output arrives as a completed `ToolResult`. The stdout text is line-oriented and can be animated line by line after the result lands.

## Read

`ReadFile` returns a system metadata part plus numbered file lines. The UI should stay compact and show only a short home-relative file path such as `~/parent/file.ext`.

## Web Search

`SearchWeb` returns one large result string with repeated blocks. Each block has fields like `Title:`, `Date:`, `URL:`, and `Summary:`.

## Fetch

`FetchURL` returns extracted page content in text parts. That content is more paragraph-like than line-like.

## Write And Edit

`WriteFile` and `StrReplaceFile` mostly return short status messages. They are useful completion signals, but they are not rich live content streams.

