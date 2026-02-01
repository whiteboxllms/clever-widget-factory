#!/bin/bash
# Generate database schema PDF from the existing markdown file

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MD_FILE="$PROJECT_ROOT/docs/DATABASE_SCHEMA.md"
HTML_FILE="$PROJECT_ROOT/docs/DATABASE_SCHEMA.html"
PDF_FILE="$PROJECT_ROOT/docs/DATABASE_SCHEMA.pdf"

echo "📊 Generating Database Schema PDF..."

# Check if markdown file exists
if [ ! -f "$MD_FILE" ]; then
  echo "❌ Error: $MD_FILE not found"
  echo "Run: python3 scripts/generate-db-diagram.py > docs/DATABASE_SCHEMA.md"
  exit 1
fi

# Option 1: Use Chrome/Chromium headless (most reliable)
if command -v google-chrome &> /dev/null || command -v chromium &> /dev/null; then
  CHROME=$(command -v google-chrome || command -v chromium || command -v "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
  
  echo "Using Chrome to generate PDF..."
  "$CHROME" --headless --disable-gpu --print-to-pdf="$PDF_FILE" "file://$HTML_FILE" 2>/dev/null
  
  if [ -f "$PDF_FILE" ]; then
    echo "✅ PDF generated: $PDF_FILE"
    open "$PDF_FILE"
    exit 0
  fi
fi

# Option 2: Use wkhtmltopdf
if command -v wkhtmltopdf &> /dev/null; then
  echo "Using wkhtmltopdf to generate PDF..."
  wkhtmltopdf "$HTML_FILE" "$PDF_FILE"
  
  if [ -f "$PDF_FILE" ]; then
    echo "✅ PDF generated: $PDF_FILE"
    open "$PDF_FILE"
    exit 0
  fi
fi

# Option 3: Use pandoc with mermaid filter
if command -v pandoc &> /dev/null; then
  echo "Using pandoc to generate PDF..."
  pandoc "$MD_FILE" -o "$PDF_FILE" --pdf-engine=xelatex 2>/dev/null || true
  
  if [ -f "$PDF_FILE" ]; then
    echo "✅ PDF generated: $PDF_FILE"
    open "$PDF_FILE"
    exit 0
  fi
fi

# Fallback: Just open the HTML in browser
echo "⚠️  No PDF generator found. Opening HTML in browser..."
echo "To generate PDF:"
echo "  1. Install Chrome: brew install --cask google-chrome"
echo "  2. Or install wkhtmltopdf: brew install wkhtmltopdf"
echo "  3. Or use browser: File > Print > Save as PDF"
open "$HTML_FILE"
