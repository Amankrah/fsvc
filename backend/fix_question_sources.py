"""
Script to fix question_sources and is_owner_question fields for existing QuestionBank and Question items.

This should be run once to fix the data after discovering that CSV imports weren't setting these fields.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.development')
django.setup()

from forms.models import QuestionBank, Question
from django.db import transaction


def fix_questionbank_sources():
    """Fix QuestionBank items to have proper is_owner_question and question_sources"""
    print("=" * 80)
    print("FIXING QUESTIONBANK ITEMS")
    print("=" * 80)
    
    updated_count = 0
    
    # Get all QuestionBank items
    questionbanks = QuestionBank.objects.all()
    total = questionbanks.count()
    print(f"\nFound {total} QuestionBank items to check")
    
    with transaction.atomic():
        for qb in questionbanks:
            needs_update = False
            
            # Determine proper values based on data_source
            if qb.data_source == 'internal':
                # Internal questions belong to owner
                if not qb.is_owner_question or 'owner' not in qb.question_sources:
                    qb.is_owner_question = True
                    qb.question_sources = ['owner']
                    needs_update = True
                    print(f"  ✓ Fixed internal question: {qb.question_text[:60]}...")
            
            elif qb.data_source != 'internal' and qb.research_partner_name:
                # Partner questions - use partner name as source
                partner_name = qb.research_partner_name
                expected_sources = [partner_name]
                
                # Check if it should also go to owner (collaborative)
                if qb.data_source == 'collaborative':
                    expected_sources = ['owner', partner_name]
                    qb.is_owner_question = True  # Collaborative means owner also owns it
                else:
                    qb.is_owner_question = False
                
                if qb.question_sources != expected_sources:
                    qb.question_sources = expected_sources
                    needs_update = True
                    print(f"  ✓ Fixed partner question: {qb.question_text[:60]}... -> {expected_sources}")
            
            else:
                # Fallback: if no partner name but non-internal, treat as owner
                if not qb.question_sources:
                    qb.is_owner_question = True
                    qb.question_sources = ['owner']
                    needs_update = True
                    print(f"  ✓ Fixed (fallback to owner): {qb.question_text[:60]}...")
            
            if needs_update:
                qb.save(update_fields=['is_owner_question', 'question_sources'])
                updated_count += 1
    
    print(f"\n✅ Updated {updated_count} of {total} QuestionBank items")
    return updated_count


def fix_question_sources():
    """Fix Question items to inherit proper sources from their QuestionBank source"""
    print("\n" + "=" * 80)
    print("FIXING QUESTION ITEMS")
    print("=" * 80)
    
    updated_count = 0
    
    # Get all Questions that have a QuestionBank source
    questions = Question.objects.filter(question_bank_source__isnull=False).select_related('question_bank_source')
    total = questions.count()
    print(f"\nFound {total} Question items with QuestionBank sources to check")
    
    with transaction.atomic():
        for question in questions:
            bank_source = question.question_bank_source
            needs_update = False
            
            # Sync from QuestionBank
            if question.is_owner_question != bank_source.is_owner_question:
                question.is_owner_question = bank_source.is_owner_question
                needs_update = True
            
            if question.question_sources != bank_source.question_sources:
                question.question_sources = bank_source.question_sources
                needs_update = True
            
            if needs_update:
                question.save(update_fields=['is_owner_question', 'question_sources'])
                updated_count += 1
                print(f"  ✓ Fixed question: {question.question_text[:60]}... -> {question.question_sources}")
    
    print(f"\n✅ Updated {updated_count} of {total} Question items")
    return updated_count


def fix_questions_without_bank_source():
    """Fix Question items that don't have a QuestionBank source (manually created)"""
    print("\n" + "=" * 80)
    print("FIXING MANUALLY CREATED QUESTIONS (no QuestionBank source)")
    print("=" * 80)
    
    updated_count = 0
    
    # Get all Questions without a QuestionBank source
    questions = Question.objects.filter(question_bank_source__isnull=True)
    total = questions.count()
    print(f"\nFound {total} manually created Question items to check")
    
    if total == 0:
        print("  No manually created questions found")
        return 0
    
    with transaction.atomic():
        for question in questions:
            needs_update = False
            
            # Default: treat as owner questions
            if not question.question_sources:
                question.is_owner_question = True
                question.question_sources = ['owner']
                needs_update = True
                print(f"  ✓ Fixed manual question: {question.question_text[:60]}... -> ['owner']")
            
            if needs_update:
                question.save(update_fields=['is_owner_question', 'question_sources'])
                updated_count += 1
    
    print(f"\n✅ Updated {updated_count} of {total} manually created Question items")
    return updated_count


def main():
    print("\n" + "=" * 80)
    print("FIX QUESTION SOURCES SCRIPT")
    print("=" * 80)
    print("\nThis script will fix is_owner_question and question_sources fields")
    print("for all existing QuestionBank and Question items.")
    print("\n⚠️  This will modify your database. Press Ctrl+C to cancel.")
    print("=" * 80)
    
    input("\nPress ENTER to continue...")
    
    try:
        # Fix QuestionBank items first
        qb_count = fix_questionbank_sources()
        
        # Fix Question items that have QuestionBank sources
        q_count = fix_question_sources()
        
        # Fix manually created Questions
        manual_count = fix_questions_without_bank_source()
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"QuestionBank items fixed: {qb_count}")
        print(f"Question items (with source) fixed: {q_count}")
        print(f"Question items (manual) fixed: {manual_count}")
        print(f"Total items fixed: {qb_count + q_count + manual_count}")
        print("=" * 80)
        print("✅ Done! The 'No database endpoints found' error should now be resolved.")
        print("=" * 80)
        
    except KeyboardInterrupt:
        print("\n\n❌ Script cancelled by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()

