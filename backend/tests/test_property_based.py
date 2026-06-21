"""
test_property_based.py — Hypothesis property-based tests for emission calculations.
Tests mathematical invariants that must hold for ALL valid inputs.
"""
import pytest
from hypothesis import given, assume, settings as h_settings, HealthCheck
from hypothesis import strategies as st
from app.services.carbon_service import CarbonService
from app.config import settings

# Strategy for valid positive consumption values
valid_values = st.floats(min_value=0.001, max_value=1000.0, allow_nan=False, allow_infinity=False)

# Valid category/subcategory pairs
TRANSPORT_SUBCATS = ['petrol_car', 'diesel_car', 'electric_vehicle', 'motorcycle', 'metro', 'bus', 'short_haul_flight', 'long_international_flight']
ENERGY_SUBCATS = ['electricity', 'gas_heating', 'water_usage']
FOOD_SUBCATS = ['beef_steak', 'chicken_breast', 'dairy_milk', 'vegetarian_meal', 'vegan_salad']
WASTE_SUBCATS = ['landfill_trash', 'recycled_materials', 'compost_organic']
SHOPPING_SUBCATS = ['clothing_purchase', 'electronics_gadget', 'misc_goods']
DIGITAL_SUBCATS = ['streaming_video', 'web_browsing', 'ai_query_session']

ALL_CATEGORIES = [
    ('transportation', TRANSPORT_SUBCATS),
    ('energy', ENERGY_SUBCATS),
    ('food', FOOD_SUBCATS),
    ('waste', WASTE_SUBCATS),
    ('shopping', SHOPPING_SUBCATS),
    ('digital', DIGITAL_SUBCATS),
]

@h_settings(suppress_health_check=[HealthCheck.too_slow], max_examples=50)
@given(value=valid_values, cat_idx=st.integers(min_value=0, max_value=5), subcat_idx=st.integers(min_value=0, max_value=7))
def test_emissions_always_positive(value, cat_idx, subcat_idx):
    """For any valid input, CO2 emissions must always be strictly positive."""
    cat, subcats = ALL_CATEGORIES[cat_idx]
    subcat = subcats[subcat_idx % len(subcats)]
    co2, explanation = CarbonService.calculate_emissions(cat, subcat, value)
    assert co2 > 0, f"Expected positive CO2 for {cat}/{subcat} value={value}, got {co2}"
    assert isinstance(explanation, str) and len(explanation) > 0

@h_settings(suppress_health_check=[HealthCheck.too_slow], max_examples=50)
@given(value=st.floats(min_value=0.001, max_value=500.0, allow_nan=False, allow_infinity=False), 
       cat_idx=st.integers(min_value=0, max_value=5), 
       subcat_idx=st.integers(min_value=0, max_value=7))
def test_emissions_proportional_to_value(value, cat_idx, subcat_idx):
    """Doubling the input value must double the calculated CO2 emissions (linearity)."""
    cat, subcats = ALL_CATEGORIES[cat_idx]
    subcat = subcats[subcat_idx % len(subcats)]
    
    co2_1, _ = CarbonService.calculate_emissions(cat, subcat, value)
    co2_2, _ = CarbonService.calculate_emissions(cat, subcat, value * 2)
    
    assert pytest.approx(co2_2) == co2_1 * 2

@h_settings(suppress_health_check=[HealthCheck.too_slow], max_examples=50)
@given(value=valid_values)
def test_petrol_greater_than_electric(value):
    """For the same distance, driving a petrol car must emit more CO2 than an electric vehicle."""
    co2_petrol, _ = CarbonService.calculate_emissions("transportation", "petrol_car", value)
    co2_electric, _ = CarbonService.calculate_emissions("transportation", "electric_vehicle", value)
    assert co2_petrol > co2_electric

@h_settings(suppress_health_check=[HealthCheck.too_slow], max_examples=50)
@given(value=valid_values)
def test_beef_greater_than_vegan(value):
    """Beef emissions must be greater than vegan food emissions for the same weight."""
    co2_beef, _ = CarbonService.calculate_emissions("food", "beef", value)
    co2_vegan, _ = CarbonService.calculate_emissions("food", "vegan", value)
    assert co2_beef > co2_vegan

@h_settings(suppress_health_check=[HealthCheck.too_slow], max_examples=50)
@given(value=valid_values)
def test_landfill_greater_than_recycled(value):
    """Landfill waste emissions must be greater than recycled materials emissions for the same weight."""
    co2_landfill, _ = CarbonService.calculate_emissions("waste", "landfill", value)
    co2_recycled, _ = CarbonService.calculate_emissions("waste", "recycled", value)
    assert co2_landfill > co2_recycled

@given(value=st.floats(max_value=0.0, allow_nan=False, allow_infinity=False))
def test_zero_or_negative_value_raises_error(value):
    """Zero or negative consumption values must raise ValueError."""
    with pytest.raises(ValueError, match="Consumption value must be greater than zero"):
        CarbonService.calculate_emissions("transportation", "petrol_car", value)

@given(value=st.floats(min_value=100000.01, max_value=1000000.0, allow_nan=False, allow_infinity=False))
def test_transport_max_bound_enforced(value):
    """Transportation values above 100,000 must raise ValueError."""
    with pytest.raises(ValueError, match="exceeds the maximum single-log bound"):
        CarbonService.calculate_emissions("transportation", "petrol_car", value)

@given(value=st.floats(min_value=10000.01, max_value=100000.0, allow_nan=False, allow_infinity=False))
def test_food_max_bound_enforced(value):
    """Food values above 10,000 must raise ValueError."""
    with pytest.raises(ValueError, match="exceeds the maximum single-log bound"):
        CarbonService.calculate_emissions("food", "vegan", value)

@h_settings(suppress_health_check=[HealthCheck.too_slow], max_examples=50)
@given(value=valid_values, cat_idx=st.integers(min_value=0, max_value=5), subcat_idx=st.integers(min_value=0, max_value=7))
def test_explanation_contains_co2_value(value, cat_idx, subcat_idx):
    """The returned explanation must contain the formatted CO2 equivalent value."""
    cat, subcats = ALL_CATEGORIES[cat_idx]
    subcat = subcats[subcat_idx % len(subcats)]
    co2, explanation = CarbonService.calculate_emissions(cat, subcat, value)
    co2_str_1 = f"{co2:.1f}"
    co2_str_2 = f"{co2:.2f}"
    assert (co2_str_1 in explanation) or (co2_str_2 in explanation) or (f"{co2}" in explanation)

def test_regional_electricity_lower_in_fr():
    """France (FR) must have a lower grid intensity than India (IN)."""
    in_intensity = settings.GRID_INTENSITY_BY_REGION.get("IN")
    fr_intensity = settings.GRID_INTENSITY_BY_REGION.get("FR")
    assert fr_intensity < in_intensity

@h_settings(suppress_health_check=[HealthCheck.too_slow])
@given(value=valid_values)
def test_emissions_region_aware_for_electricity(value):
    """Electricity consumption in region FR must emit less than in region IN for same value."""
    co2_fr, _ = CarbonService.calculate_emissions("energy", "electricity", value, region="FR")
    co2_in, _ = CarbonService.calculate_emissions("energy", "electricity", value, region="IN")
    assert co2_fr < co2_in
