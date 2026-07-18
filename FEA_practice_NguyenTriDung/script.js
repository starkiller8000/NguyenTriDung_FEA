// Wikipedia API Service
class WikipediaAPI {
    static BASE_URL = 'https://en.wikipedia.org/w/api.php';

    static async search(query) {
        const url = `${this.BASE_URL}?action=query&generator=search&gsrlimit=20&prop=pageimages|extracts|exintro&explaintext&exlimit=max&format=json&origin=*&gsrsearch=${encodeURIComponent(query)}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return this.processSearchResults(data);
        } catch (error) {
            throw new	Error(`Search failed: ${error.message}`);
        }
    }

    static async getArticle(title) {
        const url = `${this.BASE_URL}?action=query&titles=${encodeURIComponent(title)}&prop=extracts|pageimages|info&pithumbsize=400&inprop=url&redirects=&format=json&origin=*`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return this.processArticleResult(data);
        } catch (error) {
            throw new Error(`Article retrieval failed: ${error.message}`);
        }
    }

    static async getSuggestions(query) {
        const url = `${this.BASE_URL}?action=query&generator=search&gsrlimit=3&prop=pageimages|extracts&exintro&explaintext&exlimit=max&format=json&origin=*&gsrsearch=${encodeURIComponent(query)}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return this.processSearchResults(data);
        } catch (error) {
            console.error('Suggestions failed:', error);
            return [];
        }
    }

    static processSearchResults(data) {
        if (!data.query || !data.query.pages) return [];
        
        return Object.values(data.query.pages)
            .filter(page => page.pageid !== -1)
            .map(page => ({
                pageid: page.pageid,
                title: page.title,
                extract: page.extract || 'No description available.',
                thumbnail: page.thumbnail ? page.thumbnail.source : null
            }));
    }

    static processArticleResult(data) {
        if (!data.query || !data.query.pages) return null;
        
        const pages = Object.values(data.query.pages);
        const page = pages.find(p => p.pageid !== -1);
        
        if (!page) return null;
        
        return {
            pageid: page.pageid,
            title: page.title,
            extract: page.extract || 'No content available.',
            thumbnail: page.thumbnail ? page.thumbnail.source : null,
            fullurl: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
        };
    }
}

// UI Controller
class UIController {
    constructor() {
        this.searchForm = document.getElementById('searchForm');
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchSpinner = document.getElementById('searchSpinner');
        this.searchBtnText = document.getElementById('searchBtnText');
        this.validationMessage = document.getElementById('validationMessage');
        this.suggestionBox = document.getElementById('suggestionBox');
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.searchResults = document.getElementById('searchResults');
        this.resultsGrid = document.getElementById('resultsGrid');
        this.articleDetail = document.getElementById('articleDetail');
        this.articleContent = document.getElementById('articleContent');
        this.backBtn = document.getElementById('backBtn');
        
        this.currentResults = [];
        this.debounceTimer = null;
        
        this.initEventListeners();
    }

    initEventListeners() {
        this.searchForm.addEventListener('submit', (e) => this.handleSearch(e));
        this.searchInput.addEventListener('input', (e) => this.handleInput(e));
        this.backBtn.addEventListener('click', () => this.showSearchResults());
        
        // Close suggestion box when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !this.suggestionBox.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }

    handleInput(e) {
        const query = e.target.value.trim();
        
        // Clear previous validation message
        this.hideValidation();
        
        // Debounce suggestions
        clearTimeout(this.debounceTimer);
        
        if (query.length >= 2) {
            this.debounceTimer = setTimeout(() => {
                this.fetchSuggestions(query);
            }, 500);
        } else {
            this.hideSuggestions();
        }
    }

    async handleSearch(e) {
        e.preventDefault();
        
        const query = this.searchInput.value.trim();
        
        // Validate input
        if (query.length < 3) {
            this.showValidation('Please enter at least 3 characters');
            return;
        }
        
        this.hideSuggestions();
        this.showLoading();
        this.hideError();
        this.hideArticleDetail();
        this.hideSearchResults();
        
        try {
            const results = await WikipediaAPI.search(query);
            this.currentResults = results;
            
            if (results.length === 0) {
                this.showError('No results found. Please try a different search term.');
            } else {
                this.displaySearchResults(results);
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    async fetchSuggestions(query) {
        try {
            const suggestions = await WikipediaAPI.getSuggestions(query);
            this.displaySuggestions(suggestions);
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
        }
    }

    displaySuggestions(suggestions) {
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestionBox.innerHTML = suggestions
            .map(suggestion => `
                <div class="suggestion-item" data-title="${this.escapeHtml(suggestion.title)}">
                    ${this.escapeHtml(suggestion.title)}
                </div>
            `)
            .join('');
        
        // Add click handlers to suggestions
        this.suggestionBox.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                this.searchInput.value = item.dataset.title;
                this.hideSuggestions();
                this.searchForm.dispatchEvent(new Event('submit'));
            });
        });
        
        this.suggestionBox.classList.remove('d-none');
    }

    hideSuggestions() {
        this.suggestionBox.classList.add('d-none');
        this.suggestionBox.innerHTML = '';
    }

    displaySearchResults(results) {
        this.resultsGrid.innerHTML = results
            .map(result => this.createResultCard(result))
            .join('');
        
        // Add click handlers to result cards
        this.resultsGrid.querySelectorAll('.result-card').forEach((card, index) => {
            card.addEventListener('click', () => {
                this.showArticleDetail(results[index]);
            });
        });
        
        this.searchResults.classList.remove('d-none');
    }

    createResultCard(result) {
        const imageHtml = result.thumbnail 
            ? `<img src="${result.thumbnail}" alt="${this.escapeHtml(result.title)}" class="card-img-top">`
            : `<div class="no-image card-img-top">W</div>`;
        
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card result-card">
                    ${imageHtml}
                    <div class="card-body">
                        <h5 class="card-title">${this.escapeHtml(result.title)}</h5>
                        <p class="card-text">${this.escapeHtml(result.extract)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    async showArticleDetail(result) {
        this.hideSearchResults();
        this.showLoading();
        this.hideError();
        
        try {
            const article = await WikipediaAPI.getArticle(result.title);
            
            if (!article) {
                throw new Error('Failed to retrieve article');
            }
            
            this.displayArticle(article);
        } catch (error) {
            this.showError(error.message);
            this.showSearchResults();
        } finally {
            this.hideLoading();
        }
    }

    displayArticle(article) {
        const imageHtml = article.thumbnail 
            ? `<img src="${article.thumbnail}" alt="${this.escapeHtml(article.title)}">`
            : '';
        
        this.articleContent.innerHTML = `
            <h1>${this.escapeHtml(article.title)}</h1>
            ${imageHtml}
            <div class="article-extract">${article.extract}</div>
            <div class="article-link">
                <a href="${article.fullurl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                    Read on Wikipedia →
                </a>
            </div>
        `;
        
        this.articleDetail.classList.remove('d-none');
    }

    showSearchResults() {
        this.hideArticleDetail();
        this.hideError();
        this.searchResults.classList.remove('d-none');
    }

    hideSearchResults() {
        this.searchResults.classList.add('d-none');
    }

    hideArticleDetail() {
        this.articleDetail.classList.add('d-none');
    }

    showLoading() {
        this.loadingState.classList.remove('d-none');
        this.searchSpinner.classList.remove('d-none');
        this.searchBtnText.textContent = 'Searching...';
        this.searchBtn.disabled = true;
    }

    hideLoading() {
        this.loadingState.classList.add('d-none');
        this.searchSpinner.classList.add('d-none');
        this.searchBtnText.textContent = 'Search';
        this.searchBtn.disabled = false;
    }

    showError(message) {
        this.errorState.textContent = message;
        this.errorState.classList.remove('d-none');
    }

    hideError() {
        this.errorState.classList.add('d-none');
    }

    showValidation(message) {
        this.validationMessage.textContent = message;
        this.validationMessage.classList.remove('d-none');
    }

    hideValidation() {
        this.validationMessage.classList.add('d-none');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new UIController();
});