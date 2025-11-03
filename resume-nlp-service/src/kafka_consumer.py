"""
Kafka Consumer

Listens to Kafka topics and processes messages.

Topics:
- resume.bullet.evaluate - Evaluate single bullet point
- resume.posting.extract - Extract job posting data
- resume.pdf.parse - Parse resume PDF
- resume.text.analyze - Analyze text with NLP
"""

import json
import logging
from kafka import KafkaConsumer, KafkaProducer
from typing import Dict, Any

from src.services.bullet_evaluator import BulletEvaluator
from src.services.posting_extractor import PostingExtractor
from src.services.resume_parser import ResumeParser
from src.services.text_analyzer import TextAnalyzer

logger = logging.getLogger(__name__)

class ResumeNLPConsumer:
    def __init__(self, kafka_brokers: str):
        self.kafka_brokers = kafka_brokers
        
        # Initialize services
        self.bullet_evaluator = BulletEvaluator()
        self.posting_extractor = PostingExtractor()
        self.resume_parser = ResumeParser()
        self.text_analyzer = TextAnalyzer()
        
        # Initialize Kafka consumer
        self.consumer = KafkaConsumer(
            'resume.bullet.evaluate',
            'resume.posting.extract',
            'resume.pdf.parse',
            'resume.text.analyze',
            bootstrap_servers=kafka_brokers,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            group_id='resume-nlp-service'
        )
        
        # Initialize Kafka producer for responses
        self.producer = KafkaProducer(
            bootstrap_servers=kafka_brokers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        
        logger.info(f"Kafka consumer initialized with brokers: {kafka_brokers}")
    
    def start(self):
        """Start consuming messages."""
        logger.info("Starting Kafka consumer...")
        
        try:
            for message in self.consumer:
                try:
                    self._process_message(message)
                except Exception as e:
                    logger.error(f"Error processing message: {e}", exc_info=True)
        except KeyboardInterrupt:
            logger.info("Shutting down consumer...")
        finally:
            self.consumer.close()
            self.producer.close()
    
    def _process_message(self, message):
        """Process incoming Kafka message."""
        topic = message.topic
        data = message.value
        
        logger.info(f"Processing message from topic: {topic}")
        
        # Route to appropriate handler
        if topic == 'resume.bullet.evaluate':
            result = self._handle_bullet_evaluate(data)
            response_topic = 'resume.bullet.evaluate.response'
        
        elif topic == 'resume.posting.extract':
            result = self._handle_posting_extract(data)
            response_topic = 'resume.posting.extract.response'
        
        elif topic == 'resume.pdf.parse':
            result = self._handle_pdf_parse(data)
            response_topic = 'resume.pdf.parse.response'
        
        elif topic == 'resume.text.analyze':
            result = self._handle_text_analyze(data)
            response_topic = 'resume.text.analyze.response'
        
        else:
            logger.warning(f"Unknown topic: {topic}")
            return
        
        # Send response
        response = {
            "correlationId": data.get("correlationId"),
            "result": result
        }
        
        self.producer.send(response_topic, value=response)
        self.producer.flush()
        
        logger.info(f"Sent response to {response_topic}")
    
    def _handle_bullet_evaluate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle bullet point evaluation."""
        bullet_text = data.get("bulletText")
        role = data.get("role")
        use_llm = data.get("useLlm", False)
        
        if not bullet_text:
            return {"error": "Missing bulletText"}
        
        # Evaluate bullet
        evaluation = self.bullet_evaluator.evaluate(bullet_text, role, use_llm)
        
        # Generate fixes if requested
        if data.get("generateFixes", True):
            fixes = self.bullet_evaluator.generate_fixes(bullet_text, evaluation)
            evaluation["suggestedFixes"] = fixes
        
        return evaluation
    
    def _handle_posting_extract(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle job posting extraction."""
        text = data.get("text")
        html = data.get("html")
        
        if not text:
            return {"error": "Missing text"}
        
        # Extract posting data
        result = self.posting_extractor.extract(text, html)
        
        return result
    
    def _handle_pdf_parse(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle resume PDF parsing."""
        import base64
        
        pdf_base64 = data.get("pdfBase64")
        
        if not pdf_base64:
            return {"error": "Missing pdfBase64"}
        
        # Decode PDF
        pdf_bytes = base64.b64decode(pdf_base64)
        
        # Parse PDF
        result = self.resume_parser.parse_pdf(pdf_bytes)
        
        return result
    
    def _handle_text_analyze(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle text analysis."""
        text = data.get("text")
        
        if not text:
            return {"error": "Missing text"}
        
        # Analyze text
        result = self.text_analyzer.analyze(text)
        
        return result

def main():
    import os
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Get Kafka brokers from environment
    kafka_brokers = os.getenv('KAFKA_BROKERS', 'localhost:9092')
    
    # Start consumer
    consumer = ResumeNLPConsumer(kafka_brokers)
    consumer.start()

if __name__ == '__main__':
    main()

