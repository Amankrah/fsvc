# Response Models - QuestionBank Alignment

## Overview
This document describes the alignment of the Response models with the QuestionBank model in the forms app. This alignment enables better tracking, analytics, and data routing for responses based on question bank metadata.

## Changes Made

### 1. Respondent Model Updates

#### Added Fields:
- **RESPONDENT_CHOICES**: Aligned with `QuestionBank.RESPONDENT_CHOICES`
  - Ensures consistent respondent type values across the system
  - Includes all respondent types from input suppliers to certification schemes

- **COMMODITY_CHOICES**: Aligned with `QuestionBank.COMMODITY_CHOICES`
  - Standardizes commodity values (cocoa, maize, palm_oil, groundnut, honey)
  - Enables commodity-based filtering and analytics

#### Updated Fields:
- **respondent_type**: Now uses RESPONDENT_CHOICES for validation
- **commodity**: Now uses COMMODITY_CHOICES for validation

#### New Methods:
- `get_respondent_type_display_name()`: Returns human-readable respondent type
- `get_commodity_display_name()`: Returns human-readable commodity name
- `get_profile_summary()`: Returns comprehensive respondent profile
- `get_responses_by_category()`: Groups responses by question category
- `get_applicable_question_bank_items()`: Gets applicable QuestionBank items for this respondent

### 2. Response Model Updates

#### Added Category Choices:
- **CATEGORY_CHOICES**: Aligned with `QuestionBank.CATEGORY_CHOICES`
  - 20 categories covering the full food system value chain
  - From production to consumption and cross-cutting themes

#### Added Data Source Choices:
- **DATA_SOURCE_CHOICES**: Aligned with `QuestionBank.DATA_SOURCE_CHOICES`
  - Tracks research partner types (internal, university, NGO, etc.)
  - Enables partner-based data routing and analytics

#### New Fields:

1. **question_category** (CharField)
   - Category from QuestionBank for value chain analysis
   - Indexed for fast querying
   - Auto-populated from question.question_bank_source

2. **question_data_source** (CharField)
   - Data source/research partner from QuestionBank
   - Tracks who contributed the question
   - Default: 'internal'

3. **research_partner_name** (CharField)
   - Name of research partner from QuestionBank
   - Enables partner-specific analytics

4. **work_package** (CharField)
   - Work package identifier from QuestionBank
   - Supports work package-based reporting

5. **is_owner_question** (BooleanField)
   - Whether response is for a project owner question
   - Enables owner vs. partner question filtering

6. **question_sources** (JSONField)
   - List of sources (owner and/or partner names)
   - Supports multi-source question tracking

#### Enhanced question_bank_context Field:
Now includes comprehensive context:
- Respondent context: respondent_type, commodity, country
- Question bank metadata: category, data_source, research partner info
- Targeting information: targeted_respondents, commodities, countries
- Question assignment: assigned_respondent_type, assigned_commodity, assigned_country
- Priority and ownership: priority_score, is_owner_question, question_sources

#### New Indexes:
- `question_category`: Fast filtering by value chain category
- `question_data_source`: Fast filtering by research partner
- `work_package`: Fast filtering by work package
- `is_owner_question`: Fast filtering by ownership

#### New Methods:

1. **get_question_bank_summary()**
   - Returns comprehensive question bank context summary
   - Includes category, data source, partner, work package, ownership

2. **is_from_question_bank()**
   - Checks if response is from a QuestionBank-generated question
   - Returns True if question has a question_bank_source

3. **get_value_chain_position()**
   - Maps question category to value chain position
   - Returns: 'upstream', 'midstream', 'downstream', or 'cross_cutting'

4. **should_route_to_partner()**
   - Checks if response should be routed to research partner
   - Based on data_source and partner information

5. **get_partner_endpoints()**
   - Gets list of partner database endpoints for routing
   - Uses question.get_database_endpoints()

6. **Class Methods for Analytics:**
   - `get_responses_by_category(project, category)`: Filter by category
   - `get_responses_by_data_source(project, data_source)`: Filter by partner
   - `get_responses_by_work_package(project, work_package)`: Filter by work package
   - `get_analytics_summary(project, group_by)`: Group responses by various dimensions

### 3. Serializer Updates

#### RespondentSerializer:
Added fields:
- `respondent_type_display`: Human-readable respondent type
- `commodity_display`: Human-readable commodity name
- `profile_summary`: Comprehensive profile information

#### ResponseSerializer:
Added fields:
- `question_category`: Question's value chain category
- `question_data_source`: Research partner/data source
- `research_partner_name`: Partner name
- `work_package`: Work package identifier
- `is_owner_question`: Question ownership flag
- `question_sources`: List of question sources
- `question_bank_summary`: Complete question bank context
- `is_from_question_bank`: QuestionBank origin flag
- `value_chain_position`: Value chain position (upstream/midstream/downstream)

All new fields are read-only and auto-populated during response creation.

### 4. Auto-Population Logic

The Response model's `save()` method now:

1. Auto-populates question metadata from QuestionBank source:
   - question_category
   - question_data_source
   - research_partner_name
   - work_package

2. Auto-populates question ownership from Question model:
   - is_owner_question
   - question_sources

3. Auto-populates comprehensive question_bank_context including:
   - Respondent context (type, commodity, country)
   - QuestionBank metadata (category, source, partner info)
   - Targeting information (targeted respondents, commodities, countries)
   - Assignment context (assigned type, commodity, country)
   - Priority and ownership information

## Database Migration

Migration file: `responses/migrations/0004_response_is_owner_question_and_more.py`

Operations:
1. Add new fields to Response model
2. Update Respondent model field choices
3. Update Response.question_bank_context help text
4. Create indexes for performance optimization

Run with:
```bash
python manage.py migrate responses
```

## Usage Examples

### 1. Get Responses by Category
```python
from responses.models import Response

# Get all production-related responses
production_responses = Response.get_responses_by_category(project, category='production')

# Get all responses grouped by category
category_summary = Response.get_analytics_summary(project, group_by='category')
```

### 2. Get Responses by Research Partner
```python
# Get all partner university responses
partner_responses = Response.get_responses_by_data_source(
    project, 
    data_source='partner_university'
)

# Get partner-based summary
partner_summary = Response.get_analytics_summary(project, group_by='data_source')
```

### 3. Get Value Chain Analysis
```python
# Check value chain position
response = Response.objects.first()
position = response.get_value_chain_position()  # 'upstream', 'midstream', 'downstream'

# Get question bank summary
summary = response.get_question_bank_summary()
# Returns: {
#     'question_category': 'production',
#     'data_source': 'partner_university',
#     'research_partner': 'University of Ghana',
#     'work_package': 'WP1-Production',
#     ...
# }
```

### 4. Respondent Profile and Applicable Questions
```python
respondent = Respondent.objects.first()

# Get profile summary
profile = respondent.get_profile_summary()

# Get applicable QuestionBank items
applicable_questions = respondent.get_applicable_question_bank_items()
```

## Benefits

1. **Better Analytics**: 
   - Response data can be analyzed by value chain category
   - Partner contributions are clearly tracked
   - Work package reporting is simplified

2. **Improved Data Routing**:
   - Responses can be routed to appropriate research partners
   - Owner vs. partner data separation is clear
   - Multi-source questions are properly tracked

3. **Enhanced Reporting**:
   - Value chain position analysis
   - Research partner contribution tracking
   - Work package progress monitoring

4. **Historical Accuracy**:
   - All QuestionBank context is captured at response time
   - Changes to QuestionBank don't affect historical data
   - Complete audit trail of question origins

5. **API Enhancement**:
   - Rich serializer output with all QuestionBank metadata
   - Display names for codes (respondent types, commodities)
   - Ready-to-use summaries for frontend

## API Examples

### Response List with QuestionBank Context
```json
GET /api/responses/

{
  "response_id": "uuid",
  "question_category": "production",
  "question_data_source": "partner_university",
  "research_partner_name": "University of Ghana",
  "work_package": "WP1-Production",
  "is_owner_question": false,
  "question_sources": ["Partner A", "Partner B"],
  "question_bank_summary": {
    "question_category": "production",
    "data_source": "partner_university",
    "research_partner": "University of Ghana",
    "work_package": "WP1-Production",
    "respondent_type": "farmers",
    "commodity": "cocoa",
    "country": "Ghana"
  },
  "is_from_question_bank": true,
  "value_chain_position": "upstream",
  ...
}
```

### Respondent with Display Names
```json
GET /api/respondents/

{
  "id": "uuid",
  "respondent_type": "farmers",
  "respondent_type_display": "Farmers",
  "commodity": "cocoa",
  "commodity_display": "Cocoa",
  "profile_summary": {
    "respondent_id": "RESP001",
    "respondent_type": "Farmers",
    "commodity": "Cocoa",
    "country": "Ghana",
    "total_responses": 45,
    "completion_rate": 95.5
  },
  ...
}
```

## Migration Path

For existing data:
1. Run migration to add new fields
2. Fields will be auto-populated for new responses
3. Existing responses will have blank values (acceptable as historical context)
4. Optional: Run a data migration script to backfill if needed

## Related Documentation

- [QuestionBank Model](../forms/models.py) - Source of truth for choices and structure
- [Question Model](../forms/models.py) - Connects QuestionBank to projects
- [Database Router](./database_router.py) - Routes responses to partner databases
- [Response Serializers](./serializers.py) - API representation

## Future Enhancements

1. Add data migration script to backfill existing responses
2. Create analytics dashboard for value chain analysis
3. Add work package progress tracking endpoints
4. Implement advanced partner contribution analytics
5. Add automated response routing based on question_sources

