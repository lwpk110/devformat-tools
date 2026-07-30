import json

with open('src/data/converters.json', 'r', encoding='utf-8') as f:
    converters = json.load(f)

# 每个转换器的正文内容（2-3 个结构化 section，针对长尾搜索词，原创技术内容）
content_map = {
    "json-csv": [
        {
            "heading": "How to convert JSON to CSV",
            "body": [
                "Paste a JSON object or an array of objects into the input field and the converter writes a CSV document with one header row followed by one row per record. The tool reads the keys of the first object to build the header, so every object should share the same structure for a clean spreadsheet.",
                "Nested objects and arrays are serialized as JSON strings inside the cell, which keeps CSV flat and importable by Excel, Google Sheets and database loaders. To produce a tidy table, flatten deeply nested JSON before converting."
            ]
        },
        {
            "heading": "CSV quoting and special characters",
            "body": [
                "RFC 4180 quoting is applied automatically: any field that contains a comma, double quote or line break is wrapped in double quotes, and embedded double quotes are escaped by doubling them. This means multiline values and values with commas survive a round trip back to JSON without corruption.",
                "The parser handles both \r\n and \n line endings and trims no data, so values are preserved exactly as written."
            ]
        },
        {
            "heading": "When to use CSV instead of JSON",
            "body": [
                "CSV is ideal when you need a tabular, human-readable format for spreadsheets, data exchange with legacy systems or bulk database imports. JSON is better for nested or hierarchical data. Converting between the two lets you move records between APIs and spreadsheet workflows without losing structure."
            ]
        }
    ],
    "base64": [
        {
            "heading": "What is Base64 encoding",
            "body": [
                "Base64 encodes binary or text data into a 64-character alphabet (A-Z, a-z, 0-9, + and /) so it can travel safely through text-only channels such as email, JSON, URL query strings and data URIs. Every three bytes of input become four Base64 characters, which is why encoded output is about one third larger than the original.",
                "This converter uses standard UTF-8 encoding, so non-ASCII characters like emoji and CJK text round-trip correctly without mojibake."
            ]
        },
        {
            "heading": "Encoding vs encryption",
            "body": [
                "Base64 is an encoding, not encryption. Anyone can decode it, so never use it to protect secrets or passwords. Its purpose is transport safety, not confidentiality. For security, combine Base64 transport with a real encryption layer such as AES."
            ]
        },
        {
            "heading": "Common Base64 use cases",
            "body": [
                "Embed images and fonts as data URIs in CSS and HTML, store small binary blobs inside JSON or YAML configuration, transfer credentials in HTTP Basic authentication headers, and attach files in MIME email. Each of these channels only reliably handles text, so Base64 bridges binary data into them."
            ]
        }
    ],
    "json-yaml": [
        {
            "heading": "How JSON maps to YAML",
            "body": [
                "YAML is a superset of JSON, so every valid JSON document is also valid YAML. This converter turns JSON braces and brackets into clean YAML indentation, producing configuration that is easier to read and edit by hand for Kubernetes manifests, CI pipelines and application settings.",
                "Nested objects become indented mappings, arrays become dash-prefixed list items, and strings are emitted without quotes whenever it is safe to do so."
            ]
        },
        {
            "heading": "YAML formatting conventions",
            "body": [
                "The output uses two-space indentation and folds long JSON onto readable lines. Keys keep their original order, and null values render as the bare word null. Booleans and numbers are typed exactly like JSON, so types round-trip correctly when you convert back."
            ]
        },
        {
            "heading": "Choosing YAML for configuration",
            "body": [
                "YAML shines for human-edited configuration because it supports comments, multiline strings and anchors, which JSON does not. Converting JSON to YAML lets you take machine-generated configuration and add documentation and structure before committing it to a repository."
            ]
        }
    ],
    "json-xml": [
        {
            "heading": "Converting JSON to XML",
            "body": [
                "JSON objects become XML elements, object keys become element names, and arrays become repeated child elements. To express XML attributes, the converter follows the @-prefix convention: a key named @id becomes an attribute id on the element, while #text sets the element's text content.",
                "This mapping keeps the conversion lossless and reversible, so you can round-trip between JSON and XML without dropping metadata."
            ]
        },
        {
            "heading": "Safe XML parsing",
            "body": [
                "The parser rejects dangerous constructs such as external entity declarations (XXE) and document type definitions, which are a common source of XML security vulnerabilities. Only well-formed elements, attributes and text are accepted, so untrusted input cannot reach the file system or the network."
            ]
        },
        {
            "heading": "JSON vs XML for data exchange",
            "body": [
                "XML is still required by SOAP services, legacy enterprise systems and many document standards. JSON is lighter and dominates modern APIs. Converting between them lets an XML-based system consume JSON payloads and vice versa without manual rewriting."
            ]
        }
    ],
    "unix-timestamp": [
        {
            "heading": "Understanding Unix timestamps",
            "body": [
                "A Unix timestamp counts the seconds that have elapsed since 1970-01-01 00:00:00 UTC, known as the Unix epoch. It is timezone-independent and used everywhere from databases and logs to cache headers and cron jobs. This converter detects whether your input is in seconds or milliseconds automatically.",
                "Because the value is a plain number, timestamps sort naturally and avoid the ambiguity of localized date strings."
            ]
        },
        {
            "heading": "Converting in both directions",
            "body": [
                "Paste a numeric timestamp to see the equivalent ISO 8601 UTC date and time, or paste an ISO 8601 date to get the Unix seconds back. Millisecond timestamps, common in JavaScript and Java, are recognised when the magnitude falls in the millisecond range."
            ]
        },
        {
            "heading": "Timezone and ISO 8601 notes",
            "body": [
                "All conversions use UTC, the same reference as the Unix epoch. To display a local time, convert the timestamp in your application using its own timezone rules. ISO 8601 output includes the trailing Z to mark UTC explicitly."
            ]
        }
    ],
    "json-to-go-struct": [
        {
            "heading": "Generating Go structs from JSON",
            "body": [
                "Paste a JSON object and the converter emits a set of typed Go structs, one per nested object, with field names exported in PascalCase and json tags that preserve the original keys. This matches the convention used by the encoding/json package, so the generated code deserializes your payload without extra mapping.",
                "Arrays become slices, nested objects become referenced struct types, and null values are handled with pointer or omitempty-friendly tagging."
            ]
        },
        {
            "heading": "Type inference rules",
            "body": [
                "Numbers become float64 by default, the type encoding/json uses during generic decoding. Booleans map to bool, strings to string, and arrays to []T. When you need int or a specific width, adjust the generated field type after pasting."
            ]
        },
        {
            "heading": "Integrating with your Go project",
            "body": [
                "Copy the generated structs into a models package and pass a value of the root struct to json.Unmarshal. Because the json tags match your API keys exactly, you avoid manual field-by-field mapping and can evolve the types as the schema changes."
            ]
        }
    ],
    "json-to-typescript": [
        {
            "heading": "Generating TypeScript interfaces from JSON",
            "body": [
                "Paste a JSON object and the converter produces clean, idiomatic TypeScript interfaces, one per nested object, with descriptive names derived from the keys. Arrays become T[], optional fields are marked, and the output is ready to paste directly into a .ts file.",
                "The generated types let the compiler catch spelling mistakes and schema drift at build time instead of at runtime."
            ]
        },
        {
            "heading": "Naming and nesting",
            "body": [
                "Each nested object is promoted to its own interface and named after its parent key in PascalCase, which keeps deeply nested payloads readable. Union types and optional members are inferred when a field is null or missing, so the types reflect real API responses."
            ]
        },
        {
            "heading": "Using the generated types",
            "body": [
                "Add the interfaces to your project and annotate fetch or API client calls with them. Pair the types with a runtime validator such as zod when you consume untrusted data, so both compile-time and runtime safety are covered."
            ]
        }
    ],
    "json-to-python-dataclass": [
        {
            "heading": "Generating Python dataclasses from JSON",
            "body": [
                "Paste a JSON object and the converter emits typed Python dataclasses, including nested classes for nested objects and lists with element types. The output uses the @dataclass decorator and standard typing imports, so it works with both dataclasses and modern type checkers.",
                "Because dataclasses generate __init__, __repr__ and equality for free, you get value objects that are easy to construct, compare and log."
            ]
        },
        {
            "heading": "Type annotations and nesting",
            "body": [
                "Strings map to str, numbers to float, booleans to bool, and arrays to list[T]. Nested objects become their own dataclasses referenced by name, which keeps deeply structured payloads organized across multiple classes instead of one flat dictionary."
            ]
        },
        {
            "heading": "Loading JSON into dataclasses",
            "body": [
                "After pasting the dataclasses, parse the JSON with json.loads and construct the root class, or use a library like dacite or pydantic to populate nested fields automatically. This turns raw dictionaries into objects with attribute access and type checking."
            ]
        }
    ],
    "json-to-rust-struct": [
        {
            "heading": "Generating serde-ready Rust structs",
            "body": [
                "Paste a JSON object and the converter emits Rust structs with serde derive attributes and rename rules that keep the original JSON keys. The output is ready for serde_json::from_str, so you can deserialize API payloads into strongly typed values with compile-time guarantees.",
                "Optional fields become Option<T>, arrays become Vec<T>, and nested objects become referenced structs, matching how serde models real-world data."
            ]
        },
        {
            "heading": "Rename rules and field mapping",
            "body": [
                "serde's rename_all = \"camelCase\" or \"snake_case\" rules are applied so that idiomatic JSON keys map to idiomatic Rust field names without per-field attributes. This keeps the generated code concise even for large payloads."
            ]
        },
        {
            "heading": "Integrating with a Rust project",
            "body": [
                "Add serde and serde_json to Cargo.toml, paste the structs into a module, and call serde_json::from_str::<RootType>(&payload). The compiler then verifies every field access, eliminating a whole class of runtime key errors."
            ]
        }
    ],
}

# 每个转换器扩充的 FAQ（追加到现有 2 条之后，覆盖更多长尾搜索意图）
faq_map = {
    "json-csv": [
        {"q": "Is my data uploaded to a server?", "a": "No. All conversion happens in your browser memory. Nothing is sent, stored or logged on a server."},
        {"q": "What is the maximum CSV file size?", "a": "The limit is your device memory. Most browsers handle files of several megabytes instantly; very large files may take a moment but still never leave your computer."},
        {"q": "Does it handle nested JSON objects?", "a": "Yes. Nested objects and arrays are serialized as JSON text inside the CSV cell so the data is preserved. Flatten the JSON first if you need each key as its own column."},
        {"q": "Can I download the result?", "a": "Yes. Use the Download button to save the converted output as a file with the matching extension."}
    ],
    "base64": [
        {"q": "Does it support UTF-8 and emoji?", "a": "Yes. Text is encoded as UTF-8 before Base64, so emoji, CJK characters and other non-ASCII text round-trip correctly."},
        {"q": "Is Base64 secure?", "a": "No. Base64 is reversible encoding, not encryption. Anyone can decode it, so never use it to protect secrets or passwords."},
        {"q": "Why is the encoded text longer?", "a": "Base64 turns every three bytes into four characters, so encoded output is about 33% larger than the original binary data."},
        {"q": "Can I encode images or binary files?", "a": "This tool encodes text. For binary files, convert them to Base64 in your application using the platform's built-in APIs."}
    ],
    "json-yaml": [
        {"q": "Is YAML a superset of JSON?", "a": "Yes. Every valid JSON document is also valid YAML, which is why conversion between them is lossless and reversible."},
        {"q": "Does it preserve key order?", "a": "Yes. Keys keep their original order from the JSON, so the YAML output matches your source document structure."},
        {"q": "Can YAML have comments?", "a": "Yes, YAML supports comments with # while JSON does not. Converting JSON to YAML lets you add documentation to machine-generated configuration."},
        {"q": "Does it handle nested objects and arrays?", "a": "Yes. Nested objects become indented mappings and arrays become dash-prefixed list items, preserving the full hierarchy."}
    ],
    "json-xml": [
        {"q": "How are XML attributes represented in JSON?", "a": "Attributes use the @ prefix convention: a key like @id becomes an XML attribute id, and #text sets the element's text content. This keeps the conversion reversible."},
        {"q": "Is it safe against XXE attacks?", "a": "Yes. The parser rejects external entity declarations and document type definitions, so untrusted input cannot access the file system or network."},
        {"q": "Does it support repeated elements as arrays?", "a": "Yes. Repeated child elements with the same name are mapped to a JSON array, and single elements map to an object."},
        {"q": "Can I round-trip between JSON and XML?", "a": "Yes. Using the @ attribute and #text conventions, data converts back and forth without losing metadata or structure."}
    ],
    "unix-timestamp": [
        {"q": "What is the Unix epoch?", "a": "The Unix epoch is 1970-01-01 00:00:00 UTC. A Unix timestamp counts the seconds elapsed since that moment and is independent of timezones."},
        {"q": "Does it detect seconds vs milliseconds?", "a": "Yes. The converter recognizes whether your input is in seconds or milliseconds based on its magnitude, which is useful for JavaScript and Java timestamps."},
        {"q": "Which timezone is used?", "a": "All conversions use UTC, the same reference as the Unix epoch. The ISO 8601 output ends with Z to mark UTC explicitly."},
        {"q": "Can I convert an ISO date back to a timestamp?", "a": "Yes. Paste an ISO 8601 date and time to get the equivalent Unix timestamp in seconds."}
    ],
    "json-to-go-struct": [
        {"q": "What Go types are inferred?", "a": "Strings map to string, numbers to float64, booleans to bool and arrays to slices. Nested objects become referenced struct types with json tags."},
        {"q": "Does it generate json tags?", "a": "Yes. Each field gets a json tag that preserves the original JSON key, so encoding/json deserializes your payload without manual mapping."},
        {"q": "How are nested objects handled?", "a": "Each nested object becomes its own struct type, referenced by name. This keeps large payloads organized and strongly typed."},
        {"q": "Can I use the structs with encoding/json?", "a": "Yes. Pass a value of the root struct to json.Unmarshal and the tags handle the key mapping automatically."}
    ],
    "json-to-typescript": [
        {"q": "Does it mark optional fields?", "a": "Yes. Fields that are null or missing in the JSON are marked optional, so the types reflect real API responses that may omit keys."},
        {"q": "How are nested objects named?", "a": "Each nested object is promoted to its own interface, named after its parent key in PascalCase to keep deeply nested payloads readable."},
        {"q": "Can I paste the output into a .ts file?", "a": "Yes. The output is idiomatic TypeScript with imports and is ready to paste directly into your project."},
        {"q": "Does it work with arrays?", "a": "Yes. JSON arrays become T[] syntax with the correct element type inferred from the data."}
    ],
    "json-to-python-dataclass": [
        {"q": "Does it use the @dataclass decorator?", "a": "Yes. Each generated class uses the @dataclass decorator with standard typing imports, so __init__, __repr__ and equality are generated for free."},
        {"q": "How are lists typed?", "a": "Arrays become list[T] with the element type inferred, matching modern Python typing conventions."},
        {"q": "Are nested objects supported?", "a": "Yes. Nested objects become their own dataclasses referenced by name, keeping structured payloads organized."},
        {"q": "How do I load JSON into the dataclasses?", "a": "Parse the JSON with json.loads and construct the root class, or use a library like dacite or pydantic to populate nested fields automatically."}
    ],
    "json-to-rust-struct": [
        {"q": "Does it add serde derive attributes?", "a": "Yes. The output includes serde derive macros and rename rules so the structs deserialize directly with serde_json::from_str."},
        {"q": "How are optional fields handled?", "a": "Fields that can be null become Option<T>, and arrays become Vec<T>, matching how serde models real-world data."},
        {"q": "Does it use rename rules?", "a": "Yes. serde rename_all rules like camelCase or snake_case are applied so JSON keys map to idiomatic Rust field names without per-field attributes."},
        {"q": "Can I use it with serde_json?", "a": "Yes. Add serde and serde_json to Cargo.toml and call serde_json::from_str on the generated root type."}
    ],
}

for c in converters:
    slug = c["slug"]
    if slug in content_map:
        c["content"] = content_map[slug]
    if slug in faq_map:
        # 追加新 FAQ 到现有之后，去重
        existing_q = {f["q"] for f in c["faq"]}
        for new_faq in faq_map[slug]:
            if new_faq["q"] not in existing_q:
                c["faq"].append(new_faq)

with open('src/data/converters.json', 'w', encoding='utf-8') as f:
    json.dump(converters, f, ensure_ascii=False, indent=2)
    f.write('\n')

# 统计
for c in converters:
    secs = len(c.get("content", []))
    faqs = len(c["faq"])
    print(f"{c['slug']:30s} content:{secs} sections  faq:{faqs}")
