# LaTeX Worker Troubleshooting Guide

## Common Issues

### Compilation Failures

#### Error: "xelatex: command not found"

**Cause**: TeX Live not installed or not in PATH

**Solutions**:
```bash
# Check if xelatex is installed
which xelatex

# Install TeX Live
apt-get update && apt-get install -y texlive-full

# Verify installation
xelatex --version
```

**In Docker**:
- Ensure Dockerfile includes TeX Live installation
- Check `XELATEX_PATH` environment variable
- Verify file permissions

---

#### Error: "Undefined control sequence"

**Cause**: LaTeX command not recognized (typo or missing package)

**Example**:
```
! Undefined control sequence.
l.5 \unknowncommand
```

**Solutions**:
1. Check for typos in LaTeX command
2. Verify required packages are loaded:
   ```latex
   \usepackage{amsmath}  % For math
   \usepackage{graphicx} % For images
   ```
3. Use `\usepackage{...}` to import package providing command

**API Response**:
```json
{
  "success": false,
  "errors": [
    {
      "line": 5,
      "message": "Undefined control sequence: \\unknowncommand",
      "severity": "error"
    }
  ]
}
```

---

#### Error: "Missing package"

**Cause**: Required LaTeX package not installed

**Example**:
```
! LaTeX Error: File `tikz.sty' not found
```

**Solutions**:
```bash
# Auto-install via API (automatic)
# or manual:

tlmgr update --self
tlmgr install tikz pgfplots

# List installed packages
tlmgr list --installed
```

---

#### Error: "Compilation timeout"

**Cause**: Compilation exceeded 60-second timeout (default)

**Solutions**:
1. **Simplify document** (remove complex graphics, fonts)
2. **Increase timeout** (request param):
   ```json
   {
     "settings": {
       "timeout": 120000
     }
   }
   ```
3. **Check system load** (may indicate resource shortage)

**In Kubernetes**:
```yaml
env:
- name: TIMEOUT
  value: "120000"
```

---

#### Error: "Memory limit exceeded"

**Cause**: Document too large or insufficient memory

**Solutions**:
1. **Increase pod memory**:
   ```yaml
   resources:
     limits:
       memory: "4Gi"
   ```
2. **Split document** (use \include instead of \input)
3. **Reduce images** (compress before including)
4. **Disable shell escape** (reduces memory overhead)

---

### Connectivity Issues

#### MongoDB Connection Failed

**Error**:
```
MongooseError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solutions**:
```bash
# Check MongoDB is running
mongosh --host localhost --port 27017

# Verify connection string
echo $MONGODB_URI

# Update environment
MONGODB_URI=mongodb://user:pass@mongo:27017/latex-worker?authSource=admin
```

**In Docker Compose**:
```bash
docker-compose logs mongo
docker-compose restart mongo
```

---

#### Kafka Connection Failed

**Error**:
```
KafkaJSConnectionError: Failed to connect to broker kafka:9092
```

**Solutions**:
```bash
# Check Kafka is running
kafka-broker-api-versions --bootstrap-server kafka:9092

# Verify topic exists
kafka-topics --bootstrap-server kafka:9092 --list

# Create topics if missing
kafka-topics --bootstrap-server kafka:9092 --create \
  --topic latex.compile.request --partitions 3 --replication-factor 2
```

**In Docker Compose**:
```bash
docker-compose logs kafka
docker-compose restart kafka
```

---

### Performance Issues

#### Slow Compilation

**Symptoms**: Compilation takes 30+ seconds for simple doc

**Diagnostics**:
```bash
# Check system resources
top  # Monitor CPU, memory
df   # Check disk space
iotop # Monitor I/O

# Check MongoDB performance
db.documents.stats()

# Check logs
docker logs latex-worker | grep -i slow
```

**Solutions**:
1. **Clear cache and temporary files**:
   ```bash
   rm -rf /tmp/texmf-*
   rm -rf /tmp/latex-worker/*
   ```

2. **Restart worker pod**:
   ```bash
   kubectl rollout restart deployment/latex-worker -n latex-worker
   ```

3. **Reduce document complexity**:
   - Disable shell escape if not needed
   - Reduce number of packages
   - Simplify custom fonts

4. **Optimize database**:
   ```javascript
   // Create indexes
   db.documents.createIndex({ userId: 1, createdAt: -1 })
   db.projects.createIndex({ userId: 1 })
   ```

---

#### High Memory Usage

**Check Usage**:
```bash
# Docker
docker stats latex-worker

# Kubernetes
kubectl top pods -n latex-worker

# Process level
ps aux | grep node
```

**Solutions**:
1. **Reduce concurrent jobs**:
   ```yaml
   env:
   - name: MAX_CONCURRENT_JOBS
     value: "5"
   ```

2. **Enable memory limits**:
   ```yaml
   resources:
     limits:
       memory: "2Gi"
   ```

3. **Find memory leak**:
   ```bash
   # Enable heap snapshots
   NODE_OPTIONS="--max-old-space-size=2048" npm start
   
   # Analyze with clinic.js
   clinic doctor -- node src/main.ts
   ```

---

### Request Issues

#### Invalid LaTeX Content

**Error**:
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Content length exceeds 10MB limit"
  }
}
```

**Solutions**:
1. **Check content size**:
   ```javascript
   const size = Buffer.byteLength(content, 'utf8');
   if (size > 10 * 1024 * 1024) {
     // Split into multiple documents
   }
   ```

2. **Compress images** before embedding:
   ```bash
   convert image.png -quality 85 image-compressed.png
   ```

---

#### Missing Required Fields

**Error**:
```json
{
  "statusCode": 400,
  "message": ["jobId must be a string", "userId is required"]
}
```

**Solution**: Verify request includes all required fields:
```json
{
  "jobId": "string (required)",
  "userId": "string (required)",
  "content": "string (required)"
}
```

---

### Bibliography Issues

#### Citations Not Compiling

**Symptoms**:
```
! Package natbib Warning: Citation `foo2023' on page 1 undefined
```

**Causes**:
1. Bibliography file not found
2. Citation key typo
3. Bibtex/Biber not run

**Solutions**:
```latex
\documentclass{article}
\usepackage[authoryear]{natbib}  % Or biblatex
\bibliography{references}  % Correct path to .bib
\begin{document}
\cite{foo2023}  % Exact key from .bib
\bibliographystyle{plainnat}
\end{document}
```

**Verify .bib file**:
```bash
# Check syntax
bibtex input references.bib

# Look for specific entry
grep -A 5 "@article{foo2023" references.bib
```

---

#### Missing Bibliography Entries

**Error**:
```
! Package biblatex Warning: Missing required fields in bibliography entry 'foo2023'
```

**Solution**: Add required fields to bibliography entry:
```bibtex
@article{foo2023,
  author = {John Doe},
  title = {Important Research},
  journal = {Nature},
  year = {2023},
  volume = {123},
  pages = {45--67}  % Required for articles
}
```

---

### Font Issues

#### Font Not Available

**Error**:
```
! Font \TU/Roboto(0)/m/n/10 = Roboto at 10 pt not loadable: metric data not found
```

**Solutions**:
1. **Use system fonts** that are installed:
   ```bash
   fc-list | grep -i roboto
   ```

2. **Install font**:
   ```bash
   apt-get install fonts-roboto
   fc-cache -fv
   ```

3. **Use TeX Live fonts** instead:
   ```latex
   \usepackage{fontspec}
   \setmainfont{Latin Modern Roman}  % Built-in TeX font
   ```

---

#### Unicode Characters Not Rendering

**Error**:
```
! Package fontspec Error: The font "Noto Sans" does not contain the script "CJK".
```

**Solutions**:
1. **Use XeLaTeX** (supports Unicode better):
   ```bash
   xelatex input.tex
   ```

2. **Install Unicode font**:
   ```bash
   apt-get install fonts-noto-cjk
   ```

3. **Specify font explicitly**:
   ```latex
   \usepackage{fontspec}
   \setmainfont{Noto Sans CJK SC}[
     Script=CJK,
     Language=Chinese
   ]
   ```

---

## Debugging Tools

### Enable Debug Logging

```bash
# Environment variable
LOG_LEVEL=debug npm start

# Docker Compose
services:
  latex-worker:
    environment:
      - LOG_LEVEL=debug
```

### Check Compilation Logs

```bash
# Get detailed logs
curl http://localhost:3003/latex/jobs/{jobId}/logs

# Response includes:
{
  "stdout": "[XeLaTeX output]",
  "stderr": "[error output]",
  "rawLog": "[complete LaTeX log]"
}
```

### Validate LaTeX Syntax

```bash
# API endpoint
curl -X POST http://localhost:3003/latex/validate \
  -H "Content-Type: application/json" \
  -d '{"content": "\\documentclass{article}\\invalid\\end{document}"}'

# Response
{
  "valid": false,
  "errors": [...]
}
```

### Test Connectivity

```bash
# MongoDB
mongosh $MONGODB_URI --eval "db.adminCommand('ping')"

# Kafka
kafka-broker-api-versions --bootstrap-server $KAFKA_BROKERS

# TeX Live
xelatex --version
tlmgr --version
```

---

## Getting Help

### Check Logs

```bash
# Docker
docker logs -f latex-worker

# Kubernetes
kubectl logs -f deployment/latex-worker -n latex-worker

# Follow specific component
kubectl logs -f deployment/latex-worker -n latex-worker | grep ERROR
```

### Collect Debug Info

```bash
# System info
uname -a

# Docker info
docker version
docker info

# Application version
npm list

# Environment
env | grep LATEX
env | grep MONGO
env | grep KAFKA
```

### Report Issue

Include:
1. Error message and stack trace
2. LaTeX document content (if possible)
3. Request/response JSON
4. System logs (last 100 lines)
5. Environment variables (sanitized)
6. Steps to reproduce
