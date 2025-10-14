"""
Question Import/Export functionality for CSV and Excel files
"""
import csv
import io
import json
from typing import List, Dict, Any, Tuple
from django.http import HttpResponse
from django.utils import timezone
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from .models import QuestionBank, Question


class QuestionImportExport:
    """Handle import/export of questions from CSV/Excel"""

    # Template column definitions
    TEMPLATE_COLUMNS = [
        'question_text',
        'response_type',
        'question_source',
        'targeted_respondents',
        'targeted_commodities',
        'targeted_countries',
        'is_required',
        'options',
    ]

    # Column descriptions for template
    COLUMN_DESCRIPTIONS = {
        'question_text': 'The actual question text (REQUIRED)',
        'response_type': 'Type: text_short, text_long, numeric_integer, choice_single, etc. (REQUIRED)',
        'question_source': 'Source: owner, partner_name, or owner,partner_name (REQUIRED)',
        'targeted_respondents': 'Comma-separated: farmers,processors,retailers (REQUIRED)',
        'targeted_commodities': 'Comma-separated: cocoa,maize,palm_oil (REQUIRED)',
        'targeted_countries': 'Comma-separated: Ghana,Nigeria,Kenya (REQUIRED)',
        'is_required': 'true or false - Is this question required? (default: true)',
        'options': 'For choice questions only: Option1|Option2|Option3 (pipe-separated)',
    }

    # Valid choices
    VALID_CATEGORIES = [choice[0] for choice in QuestionBank.CATEGORY_CHOICES]
    VALID_RESPONDENTS = [choice[0] for choice in QuestionBank.RESPONDENT_CHOICES]
    VALID_COMMODITIES = [choice[0] for choice in QuestionBank.COMMODITY_CHOICES]
    VALID_DATA_SOURCES = [choice[0] for choice in QuestionBank.DATA_SOURCE_CHOICES]
    VALID_RESPONSE_TYPES = [
        'text_short', 'text_long', 'numeric_integer', 'numeric_decimal', 'scale_rating',
        'choice_single', 'choice_multiple', 'date', 'datetime', 'geopoint', 'geoshape',
        'image', 'audio', 'video', 'file', 'signature', 'barcode'
    ]

    @classmethod
    def generate_csv_template(cls) -> HttpResponse:
        """Generate CSV template with headers and example row"""
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="question_template_{timezone.now().strftime("%Y%m%d")}.csv"'

        writer = csv.writer(response)

        # Write headers
        writer.writerow(cls.TEMPLATE_COLUMNS)

        # Write descriptions row
        descriptions = [cls.COLUMN_DESCRIPTIONS.get(col, '') for col in cls.TEMPLATE_COLUMNS]
        writer.writerow(descriptions)

        # Write example row
        example_row = [
            'What is your primary source of income?',
            'choice_single',
            'owner',
            'farmers,aggregators_lbcs',
            'cocoa,maize',
            'Ghana,Nigeria',
            'true',
            'Farming|Trading|Processing|Other',
        ]
        writer.writerow(example_row)

        return response

    @classmethod
    def generate_excel_template(cls) -> HttpResponse:
        """Generate Excel template with formatting and validation"""
        workbook = openpyxl.Workbook()

        # Create main sheet
        sheet = workbook.active
        sheet.title = "Questions"

        # Style definitions
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        desc_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
        example_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")

        # Write headers
        for col_idx, column in enumerate(cls.TEMPLATE_COLUMNS, start=1):
            cell = sheet.cell(row=1, column=col_idx, value=column)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')

        # Write descriptions
        for col_idx, column in enumerate(cls.TEMPLATE_COLUMNS, start=1):
            cell = sheet.cell(row=2, column=col_idx, value=cls.COLUMN_DESCRIPTIONS.get(column, ''))
            cell.fill = desc_fill
            cell.alignment = Alignment(wrap_text=True, vertical='top')

        # Write example row
        example_row = [
            'What is your primary source of income?',
            'choice_single',
            'owner',
            'farmers,aggregators_lbcs',
            'cocoa,maize',
            'Ghana,Nigeria',
            'true',
            'Farming|Trading|Processing|Other',
        ]
        for col_idx, value in enumerate(example_row, start=1):
            cell = sheet.cell(row=3, column=col_idx, value=value)
            cell.fill = example_fill

        # Adjust column widths
        column_widths = [50, 25, 30, 35, 30, 25, 15, 40]
        for col_idx, width in enumerate(column_widths, start=1):
            sheet.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

        # Set row heights
        sheet.row_dimensions[1].height = 20
        sheet.row_dimensions[2].height = 40

        # Create reference sheet with valid values
        ref_sheet = workbook.create_sheet("Reference Values")
        ref_sheet.sheet_state = 'hidden'  # Hide by default

        # Add valid values
        ref_data = {
            'A': ('Categories', cls.VALID_CATEGORIES),
            'B': ('Response Types', cls.VALID_RESPONSE_TYPES),
            'C': ('Respondents', cls.VALID_RESPONDENTS),
            'D': ('Commodities', cls.VALID_COMMODITIES),
            'E': ('Data Sources', cls.VALID_DATA_SOURCES),
        }

        for col, (title, values) in ref_data.items():
            ref_sheet[f'{col}1'] = title
            ref_sheet[f'{col}1'].font = Font(bold=True)
            for idx, value in enumerate(values, start=2):
                ref_sheet[f'{col}{idx}'] = value

        # Save to BytesIO
        output = io.BytesIO()
        workbook.save(output)
        output.seek(0)

        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="question_template_{timezone.now().strftime("%Y%m%d")}.xlsx"'

        return response

    @classmethod
    def parse_csv(cls, file) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Parse CSV file and return list of question data dictionaries and errors"""
        questions = []
        errors = []

        try:
            # Read file content
            content = file.read().decode('utf-8-sig')  # Handle BOM
            reader = csv.DictReader(io.StringIO(content))

            # Validate headers
            required_cols = ['question_text', 'response_type', 'question_source', 'targeted_respondents', 'targeted_commodities', 'targeted_countries']
            if not all(col in reader.fieldnames for col in required_cols):
                errors.append(f"CSV must contain all required columns: {', '.join(required_cols)}")
                return [], errors

            for row_num, row in enumerate(reader, start=3):  # Start at 3 (header + description + data)
                # Skip description and example rows
                if row_num == 2 or (row.get('question_text', '').startswith('What is') and row_num == 3):
                    continue

                # Skip empty rows
                if not row.get('question_text', '').strip():
                    continue

                question_data, row_errors = cls._parse_row(row, row_num)

                if row_errors:
                    errors.extend([f"Row {row_num}: {err}" for err in row_errors])
                else:
                    questions.append(question_data)

        except Exception as e:
            errors.append(f"Failed to parse CSV: {str(e)}")

        return questions, errors

    @classmethod
    def parse_excel(cls, file) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Parse Excel file and return list of question data dictionaries and errors"""
        questions = []
        errors = []

        try:
            workbook = openpyxl.load_workbook(file, read_only=True)
            sheet = workbook.active

            # Get headers from first row
            headers = []
            for cell in sheet[1]:
                if cell.value:
                    headers.append(cell.value)

            # Validate headers
            required_cols = ['question_text', 'response_type', 'question_source', 'targeted_respondents', 'targeted_commodities', 'targeted_countries']
            if not all(col in headers for col in required_cols):
                errors.append(f"Excel must contain all required columns: {', '.join(required_cols)}")
                return [], errors

            # Parse data rows (skip header, description, and example rows)
            for row_num, row in enumerate(sheet.iter_rows(min_row=4, values_only=True), start=4):
                # Skip empty rows
                if not row[0] or not str(row[0]).strip():
                    continue

                # Create row dictionary
                row_dict = {headers[i]: (row[i] if i < len(row) else None) for i in range(len(headers))}

                question_data, row_errors = cls._parse_row(row_dict, row_num)

                if row_errors:
                    errors.extend([f"Row {row_num}: {err}" for err in row_errors])
                else:
                    questions.append(question_data)

            workbook.close()

        except Exception as e:
            errors.append(f"Failed to parse Excel: {str(e)}")

        return questions, errors

    @classmethod
    def _parse_row(cls, row: Dict[str, Any], row_num: int, project=None) -> Tuple[Dict[str, Any], List[str]]:
        """
        Parse a single row and return question data and errors.

        Args:
            row: Dictionary containing question data
            row_num: Row number for error reporting
            project: Optional Project instance to validate partner names
        """
        errors = []

        # Required fields
        question_text = str(row.get('question_text', '')).strip()
        response_type = str(row.get('response_type', '')).strip().lower()
        question_source = str(row.get('question_source', '')).strip()

        if not question_text:
            errors.append("question_text is required")

        if not response_type:
            errors.append("response_type is required")
        elif response_type not in cls.VALID_RESPONSE_TYPES:
            errors.append(f"Invalid response_type '{response_type}'. Valid: {', '.join(cls.VALID_RESPONSE_TYPES)}")

        if not question_source:
            errors.append("question_source is required")

        # Parse question source (owner, partner_name, or owner,partner_name)
        # NEW: Support multiple sources
        question_sources = []
        is_owner_question = False
        data_source = 'internal'
        research_partner_name = ''

        if question_source:
            sources = [s.strip() for s in question_source.split(',')]
            question_sources = sources  # Store all sources

            if 'owner' in sources:
                is_owner_question = True
                data_source = 'internal'

            # Check if there are partner names
            partner_sources = [s for s in sources if s.lower() != 'owner']
            if partner_sources:
                research_partner_name = ', '.join(partner_sources)  # Join all partners
                if not is_owner_question:
                    data_source = 'partner_organization'

                # Validate partner names against project configuration
                if project and hasattr(project, 'partner_organizations'):
                    registered_partners = [p.get('name') for p in project.partner_organizations]
                    for partner_name in partner_sources:
                        if partner_name not in registered_partners:
                            errors.append(
                                f"question_source contains unregistered partner '{partner_name}'. "
                                f"Registered partners: {', '.join(registered_partners) if registered_partners else 'None'}. "
                                f"Please add this partner to the project before importing questions."
                            )

        # Parse boolean fields
        is_required = cls._parse_boolean(row.get('is_required'), default=True)

        # Parse options (pipe-separated)
        options = []
        options_str = str(row.get('options', '')).strip()
        if options_str and options_str != '{}':
            options = [opt.strip() for opt in options_str.split('|') if opt.strip()]

        # Validate options for choice types
        if response_type in ['choice_single', 'choice_multiple'] and not options:
            errors.append(f"options required for response_type '{response_type}'")

        # Parse list fields (comma-separated)
        targeted_respondents = cls._parse_list_field(row.get('targeted_respondents'))
        if not targeted_respondents:
            errors.append("targeted_respondents is required")
        for respondent in targeted_respondents:
            if respondent not in cls.VALID_RESPONDENTS:
                errors.append(f"Invalid respondent '{respondent}'. Valid: {', '.join(cls.VALID_RESPONDENTS)}")

        targeted_commodities = cls._parse_list_field(row.get('targeted_commodities'))
        if not targeted_commodities:
            errors.append("targeted_commodities is required")
        for commodity in targeted_commodities:
            if commodity not in cls.VALID_COMMODITIES:
                errors.append(f"Invalid commodity '{commodity}'. Valid: {', '.join(cls.VALID_COMMODITIES)}")

        targeted_countries = cls._parse_list_field(row.get('targeted_countries'))
        if not targeted_countries:
            errors.append("targeted_countries is required")

        # Determine question category based on response type
        question_category = 'general'
        if response_type in ['text_short', 'text_long']:
            question_category = 'general'
        elif response_type in ['numeric_integer', 'numeric_decimal', 'scale_rating']:
            question_category = 'production'
        elif response_type in ['choice_single', 'choice_multiple']:
            question_category = 'general'
        elif response_type in ['date', 'datetime']:
            question_category = 'general'
        elif response_type in ['geopoint', 'geoshape']:
            question_category = 'general'
        elif response_type in ['image', 'audio', 'video', 'file', 'signature', 'barcode']:
            question_category = 'general'

        # Build question data
        question_data = {
            'question_text': question_text,
            'question_category': question_category,
            'response_type': response_type,
            'is_required': is_required,
            'allow_multiple': False,
            'options': options if options else None,
            'validation_rules': None,
            'targeted_respondents': targeted_respondents,
            'targeted_commodities': targeted_commodities,
            'targeted_countries': targeted_countries,
            'data_source': data_source,
            'research_partner_name': research_partner_name,
            'research_partner_contact': '',
            'work_package': '',
            'priority_score': 1,
            'tags': [],
            'is_active': True,
            'is_owner_question': is_owner_question,
            'question_sources': question_sources,  # NEW: Add multi-source support
        }

        return question_data, errors

    @staticmethod
    def _parse_boolean(value: Any, default: bool = False) -> bool:
        """Parse boolean value from various formats"""
        if value is None or value == '':
            return default
        if isinstance(value, bool):
            return value
        str_value = str(value).strip().lower()
        return str_value in ['true', '1', 'yes', 'y']

    @staticmethod
    def _parse_list_field(value: Any) -> List[str]:
        """Parse comma-separated list field"""
        if not value or str(value).strip() == '':
            return []
        return [item.strip() for item in str(value).split(',') if item.strip()]

    @classmethod
    def import_questions_to_bank(cls, questions_data: List[Dict[str, Any]], created_by: str = '') -> Dict[str, Any]:
        """Import questions to QuestionBank"""
        created_count = 0
        updated_count = 0
        errors = []

        for question_data in questions_data:
            try:
                # Check if question already exists (by question_text and category)
                existing = QuestionBank.objects.filter(
                    question_text=question_data['question_text'],
                    question_category=question_data['question_category']
                ).first()

                if existing:
                    # Update existing question
                    for key, value in question_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    updated_count += 1
                else:
                    # Create new question
                    question_data['created_by'] = created_by
                    QuestionBank.objects.create(**question_data)
                    created_count += 1

            except Exception as e:
                errors.append(f"Failed to import '{question_data.get('question_text', 'Unknown')}': {str(e)}")

        return {
            'created': created_count,
            'updated': updated_count,
            'errors': errors,
            'total_processed': created_count + updated_count,
        }
