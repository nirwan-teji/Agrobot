from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.recommendation import AIRecommendationResponse, CropRecommendation, CalendarEvent
from app.database.connection import get_db
from app.database.schemas import User, QuestionnaireResponse, Recommendation
from app.utils.auth_utils import get_current_user
from app.services.ai_service import ai_service
from datetime import datetime, date
import logging
import traceback

# Enhanced logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/generate", response_model=AIRecommendationResponse)
async def generate_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI recommendations based on user's questionnaire responses"""
    
    try:
        logger.info(f"🚀 Starting recommendation generation for user {current_user.id}")
        logger.info(f"👤 User: {current_user.email}, onboarding: {current_user.onboarding_completed}")
        
        # Check if user has completed questionnaire
        if not current_user.onboarding_completed:
            logger.error(f"❌ User {current_user.id} has not completed onboarding")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please complete the questionnaire first"
            )
        
        # Get all questionnaire responses for the user
        logger.info(f"📋 Fetching questionnaire responses for user {current_user.id}")
        responses = db.query(QuestionnaireResponse).filter(
            QuestionnaireResponse.user_id == current_user.id
        ).all()
        
        logger.info(f"📊 Found {len(responses)} questionnaire responses")
        
        if len(responses) < 5:
            logger.error(f"❌ Incomplete questionnaire data: only {len(responses)} responses")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Incomplete questionnaire data. Found {len(responses)} sets, need 5."
            )
        
        # Prepare user data for AI service
        user_data = {"user_id": current_user.id}
        for response in responses:
            user_data[f"set_{response.set_number}"] = response.answers
            logger.info(f"✅ Set {response.set_number} loaded: {list(response.answers.keys())}")
        
        # Generate recommendations using AI service
        logger.info("🤖 Calling AI service...")
        recommendations = await ai_service.generate_farming_recommendations(user_data)
        logger.info(f"✅ AI service returned recommendations with {len(recommendations.recommended_crops)} crops")
        
        # Save recommendations to database
        logger.info("💾 Saving recommendations to database...")
        try:
            # Convert date objects to strings for JSON serialization
            farming_calendar_serializable = []
            for event in recommendations.farming_calendar:
                event_dict = event.dict()
                # Convert date to string
                if isinstance(event_dict['date'], date):
                    event_dict['date'] = event_dict['date'].isoformat()
                farming_calendar_serializable.append(event_dict)
            
            recommended_crops_serializable = []
            for crop in recommendations.recommended_crops:
                crop_dict = crop.dict()
                recommended_crops_serializable.append(crop_dict)
            
            db_recommendation = Recommendation(
                user_id=current_user.id,
                soil_health_score=recommendations.soil_health_score,
                recommended_crops=recommended_crops_serializable,
                farming_calendar=farming_calendar_serializable,
                soil_improvement_tips=recommendations.soil_improvement_tips,
                irrigation_recommendations=recommendations.irrigation_recommendations,
                fertilizer_recommendations=recommendations.fertilizer_recommendations,
                pest_disease_prevention=recommendations.pest_disease_prevention,
                next_review_date=recommendations.next_review_date.isoformat() if recommendations.next_review_date else None
            )
            
            logger.info("📝 Created recommendation object")
            db.add(db_recommendation)
            logger.info("➕ Added to database session")
            
            db.commit()
            logger.info("💾 Committed to database")
            
            db.refresh(db_recommendation)
            logger.info(f"🔄 Refreshed - DB ID: {db_recommendation.id}")
            
        except Exception as db_error:
            logger.error(f"❌ Database save error: {type(db_error).__name__}: {db_error}")
            logger.error(f"🔍 DB Error traceback: {traceback.format_exc()}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(db_error)}"
            )
        
        logger.info("✅ Recommendations generated and saved successfully")
        return recommendations
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error: {type(e).__name__}: {e}")
        logger.error(f"🔍 Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/latest", response_model=AIRecommendationResponse)
async def get_latest_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest recommendations for the current user"""
    
    logger.info(f"📊 Fetching latest recommendations for user {current_user.id}")
    
    latest_recommendation = db.query(Recommendation).filter(
        Recommendation.user_id == current_user.id
    ).order_by(Recommendation.generated_at.desc()).first()
    
    if not latest_recommendation:
        logger.warning(f"❌ No recommendations found for user {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recommendations found. Please generate recommendations first."
        )
    
    logger.info(f"✅ Found recommendation ID {latest_recommendation.id}")
    
    # Convert database model to response model
    try:
        # Convert date strings back to date objects for farming calendar
        farming_calendar = []
        for event in latest_recommendation.farming_calendar:
            event_copy = event.copy()
            # Convert string date back to date object
            if isinstance(event_copy['date'], str):
                try:
                    event_copy['date'] = datetime.strptime(event_copy['date'], '%Y-%m-%d').date()
                except ValueError:
                    # If date parsing fails, keep as string
                    pass
            farming_calendar.append(CalendarEvent(**event_copy))
        
        # Handle next_review_date conversion
        next_review_date = None
        if latest_recommendation.next_review_date:
            try:
                next_review_date = datetime.strptime(latest_recommendation.next_review_date, '%Y-%m-%d').date()
            except ValueError:
                # If parsing fails, set to None
                next_review_date = None
        
        recommendations = AIRecommendationResponse(
            user_id=latest_recommendation.user_id,
            soil_health_score=latest_recommendation.soil_health_score,
            recommended_crops=[
                CropRecommendation(**crop) for crop in latest_recommendation.recommended_crops
            ],
            farming_calendar=farming_calendar,
            soil_improvement_tips=latest_recommendation.soil_improvement_tips,
            irrigation_recommendations=latest_recommendation.irrigation_recommendations,
            fertilizer_recommendations=latest_recommendation.fertilizer_recommendations,
            pest_disease_prevention=latest_recommendation.pest_disease_prevention,
            generated_at=latest_recommendation.generated_at,
            next_review_date=next_review_date
        )
        
        logger.info("✅ Successfully converted DB model to response")
        return recommendations
        
    except Exception as e:
        logger.error(f"❌ Error converting DB model: {type(e).__name__}: {e}")
        logger.error(f"🔍 Conversion traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing recommendations: {str(e)}"
        )

@router.get("/history")
async def get_recommendation_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recommendation history for the current user"""
    
    logger.info(f"📈 Fetching recommendation history for user {current_user.id}")
    
    recommendations = db.query(Recommendation).filter(
        Recommendation.user_id == current_user.id
    ).order_by(Recommendation.generated_at.desc()).all()
    
    logger.info(f"📊 Found {len(recommendations)} historical recommendations")
    
    return [
        {
            "id": rec.id,
            "soil_health_score": rec.soil_health_score,
            "generated_at": rec.generated_at,
            "next_review_date": rec.next_review_date,
            "crops_count": len(rec.recommended_crops) if rec.recommended_crops else 0,
            "calendar_events_count": len(rec.farming_calendar) if rec.farming_calendar else 0
        }
        for rec in recommendations
    ]
