import json
import re
import os

# Percorsi dei file da processare
FILES = [
    'data/sti-survey.json'
]

CAPITALIZED_TERMS = {
    'SVM', 'CRF', 'CNN', 'BERT', 'PGM', 'LDA', 'MLE', 'NN', 'INK', 'GPT', 'LLama 2',
    'DistilBERT', 'RoBERTa', 'XLNet', 'Transformer', 'Star-Transformers',
    'AgreementMaker', 'Siamese', 'Heuristics', 'KG', 'Maximum', 'Likelihood',
    'Estimation', 'Logistic', 'Regression', 'Cosine', 'Hierarchical', 'clustering',
    'BKG', 'Markov', 'Network', 'Neural', 'Neural Network', 'Rule', 'Base',
    'Transformer-based', 'Supervision', 'Mining', 'Markov Network', 'GPT-3.5', 'KG embedding', 'Siamese Network',
    'Random Forest', 'RandomForest', 'Decision Tree', 'DecisionTree', 'XGBoost', 'LightGBM', 'CatBoost',
    'Naive Bayes', 'NaiveBayes', 'Bayesian', 'Bayes', 'AdaBoost', 'Gradient Boosting', 'GradientBoosting',
    'KNN', 'k-NN', 'kNN', 'k-Means', 'KMeans', 'DBSCAN', 'PCA', 't-SNE', 'TSNE', 'UMAP',
    'AutoML', 'AutoGluon', 'AutoSklearn', 'TPOT', 'HPO', 'GridSearch', 'RandomSearch',
    'Ensemble', 'Stacking', 'Bagging', 'Boosting', 'Voting',
    'Rule-based', 'Pattern-based', 'Dictionary-based', 'Lexicon-based',
    'Majority Voting', 'MajorityVoting', 'Distant Supervision', 'Self-training', 'Co-training',
    'Zero-shot', 'Few-shot', 'One-shot', 'Transfer Learning', 'Meta-Learning',
    'Self-supervised', 'Semi-supervised', 'Active Learning', 'Multi-task', 'Multi-task Learning',
    'Pre-trained', 'Pretraining', 'Fine-tuning', 'FineTuning', 'Prompting', 'Prompt-based',
    'Word2Vec', 'GloVe', 'FastText', 'ELMo', 'ALBERT', 'ERNIE', 'ELECTRA', 'T5', 'BART', 'DeBERTa',
    'OpenAI', 'ChatGPT', 'GPT-2', 'GPT-3', 'GPT-4', 'LLM', 'PLM', 'BioBERT', 'SciBERT', 'PubMedBERT',
    'Entity Linking', 'Entity Disambiguation', 'Entity Recognition', 'NER', 'EL', 'ED',
    'TF-IDF', 'TFIDF', 'BM25', 'BM-25', 'Jaccard', 'Levenshtein', 'Edit Distance', 'Hamming',
    'Cosine Similarity', 'Euclidean', 'Manhattan', 'Dice', 'Overlap', 'Softmax', 'Sigmoid',
    'Attention', 'Self-Attention', 'Multi-head Attention', 'Cross-Attention',
    'Graph Neural Network', 'GNN', 'GCN', 'GAT', 'GraphSAGE', 'RGCN', 'Knowledge Graph', 'KG',
    'Embedding', 'KG Embedding', 'TransE', 'TransH', 'TransR', 'ComplEx', 'DistMult', 'RESCAL',
    'Path Ranking', 'PathRank', 'Random Walk', 'Personalized PageRank', 'PageRank',
    'Rule Mining', 'Association Rule', 'Apriori', 'FP-Growth', 'Pattern Mining',
    'Ontology-based', 'Ontology Matching', 'Ontology Alignment', 'Schema Matching', 'Schema Alignment',
    'String Matching', 'String Similarity', 'Blocking', 'Canopy', 'Sorted Neighborhood',
    'Clustering', 'Hierarchical Clustering', 'Agglomerative', 'Divisive', 'Spectral Clustering',
    'DBSCAN', 'OPTICS', 'Mean Shift', 'Affinity Propagation',
    'Siamese Network', 'Triplet Network', 'Contrastive Learning', 'Metric Learning',
    'Rule Learning', 'Inductive Logic Programming', 'ILP', 'FOIL', 'Progol',
    'Maximum Likelihood', 'Maximum A Posteriori', 'MAP', 'EM', 'Expectation Maximization',
    'Probabilistic Graphical Model', 'PGM', 'Bayesian Network', 'Markov Random Field', 'MRF',
    'Conditional Random Field', 'CRF', 'Hidden Markov Model', 'HMM',
    'Support Vector Machine', 'SVM', 'Linear Regression', 'Logistic Regression', 'Ridge Regression', 'Lasso Regression',
    'Decision Tree', 'Random Forest', 'Gradient Boosting', 'AdaBoost', 'XGBoost', 'LightGBM', 'CatBoost',
    'K-Means', 'DBSCAN', 'PCA', 't-SNE', 'UMAP',
    'Majority Voting', 'Ensemble', 'Stacking', 'Bagging', 'Boosting',
    'Rule-based', 'Pattern-based', 'Dictionary-based', 'Lexicon-based',
    'Distant Supervision', 'Self-training', 'Co-training', 'Zero-shot', 'Few-shot', 'One-shot',
    'Transfer Learning', 'Meta-Learning', 'Self-supervised', 'Semi-supervised', 'Active Learning',
    'Multi-task Learning', 'Pre-trained', 'Fine-tuning', 'Prompt-based',
    'Word2Vec', 'GloVe', 'FastText', 'ELMo', 'BERT', 'ALBERT', 'ERNIE', 'ELECTRA', 'T5', 'BART', 'DeBERTa',
    'OpenAI', 'ChatGPT', 'GPT-2', 'GPT-3', 'GPT-3.5', 'GPT-4', 'LLM', 'PLM', 'BioBERT', 'SciBERT', 'PubMedBERT',
    'Entity Linking', 'Entity Disambiguation', 'Entity Recognition', 'NER', 'EL', 'ED',
    'TF-IDF', 'BM25', 'Jaccard', 'Levenshtein', 'Edit Distance', 'Hamming',
    'Cosine Similarity', 'Euclidean', 'Manhattan', 'Dice', 'Overlap', 'Softmax', 'Sigmoid',
    'Attention', 'Self-Attention', 'Multi-head Attention', 'Cross-Attention',
    'Graph Neural Network', 'GNN', 'GCN', 'GAT', 'GraphSAGE', 'RGCN', 'Knowledge Graph', 'KG',
    'Embedding', 'KG Embedding', 'TransE', 'TransH', 'TransR', 'ComplEx', 'DistMult', 'RESCAL',
    'Path Ranking', 'Random Walk', 'Personalized PageRank', 'PageRank',
    'Rule Mining', 'Association Rule', 'Apriori', 'FP-Growth', 'Pattern Mining',
    'Ontology-based', 'Ontology Matching', 'Ontology Alignment', 'Schema Matching', 'Schema Alignment',
    'String Matching', 'String Similarity', 'Blocking', 'Canopy', 'Sorted Neighborhood',
    'Clustering', 'Hierarchical Clustering', 'Agglomerative', 'Divisive', 'Spectral Clustering',
    'OPTICS', 'Mean Shift', 'Affinity Propagation',
    'Triplet Network', 'Contrastive Learning', 'Metric Learning',
    'Rule Learning', 'Inductive Logic Programming', 'FOIL', 'Progol',
    'Maximum Likelihood', 'Maximum A Posteriori', 'EM', 'Expectation Maximization',
    'Probabilistic Graphical Model', 'Bayesian Network', 'Markov Random Field',
    'Conditional Random Field', 'Hidden Markov Model', 'Support Vector Machine', 'Linear Regression',
    'Ridge Regression', 'Lasso Regression'
}
FORCE_LOWER = {'matching'}
FORCE_TITLE = {'neural network': 'Neural Network'}

def format_technique(technique):
    if not technique:
        return technique
    # Sostituisci + e & con virgola (anche senza spazi)
    technique = re.sub(r'\s*([+&])\s*', ', ', technique)
    # Normalizza spazi multipli e virgole
    technique = re.sub(r',\s*,', ',', technique)
    technique = re.sub(r'\s{2,}', ' ', technique)
    technique = technique.strip()
    # Forza "neural network" a "Neural Network" (case insensitive)
    technique = re.sub(r'(?i)neural network', 'Neural Network', technique)
    # Forza matching a minuscolo
    technique = re.sub(r'(?i)matching', 'matching', technique)
    # Capitalizza i termini noti
    def cap_word(word):
        if word in CAPITALIZED_TERMS:
            return word
        if word.lower() in [w.lower() for w in CAPITALIZED_TERMS]:
            # Rispetta il case originale se è in CAPITALIZED_TERMS
            for t in CAPITALIZED_TERMS:
                if t.lower() == word.lower():
                    return t
        if word in FORCE_LOWER:
            return word.lower()
        return word.lower()
    # Applica la capitalizzazione solo ai singoli token separati da virgola
    parts = [w.strip() for w in technique.split(',')]
    parts = [FORCE_TITLE.get(p.lower(), cap_word(p)) for p in parts]
    return ', '.join(parts)

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    changed = False
    for entry in data:
        if 'main-method' in entry and 'technique' in entry['main-method']:
            old = entry['main-method']['technique']
            new = format_technique(old)
            if new != old:
                entry['main-method']['technique'] = new
                changed = True
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Aggiornato: {path}")
    else:
        print(f"Nessuna modifica: {path}")

if __name__ == "__main__":
    for file in FILES:
        if os.path.exists(file):
            process_file(file) 