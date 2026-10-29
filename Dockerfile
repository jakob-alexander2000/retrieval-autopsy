FROM python:3.12-slim

WORKDIR /app
COPY scorer /app/scorer
COPY fixtures /app/fixtures
RUN pip install --no-cache-dir ./scorer

ENTRYPOINT ["retrieval-autopsy"]
CMD ["fixtures/answers.jsonl"]
